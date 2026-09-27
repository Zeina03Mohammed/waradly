import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Same backend contract the web frontend uses (see public-web/assets/js/api.js) — one Node/
/// Express API, no client-side Firebase SDK needed on either client. Login/register are plain
/// REST calls; the server does the Firebase Auth work on our behalf.
///
/// On a real device this must point at the deployed Function/Hosting URL; 10.0.2.2 is the
/// Android emulator's alias for the host machine's localhost, used only for local dev against
/// the Firebase emulator suite.
const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://127.0.0.1:5000/api');

class ApiException implements Exception {
  final int status;
  final String message;
  final String? code;
  final Map<String, dynamic> fields;
  ApiException(this.status, this.message, {this.code, this.fields = const {}});
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  String? _accessToken;
  String? _refreshToken;

  Future<void> loadTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('access_token');
    _refreshToken = prefs.getString('refresh_token');
  }

  Future<void> setTokens(String accessToken, String refreshToken) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', accessToken);
    await prefs.setString('refresh_token', refreshToken);
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
  }

  bool get isLoggedIn => _accessToken != null;
  String? get accessToken => _accessToken;

  Future<bool> _tryRefresh() async {
    if (_refreshToken == null) return false;
    final res = await http.post(
      Uri.parse('$apiBaseUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refresh_token': _refreshToken}),
    );
    if (res.statusCode != 200) {
      await clearTokens();
      return false;
    }
    final data = jsonDecode(res.body);
    await setTokens(data['access_token'], data['refresh_token']);
    return true;
  }

  static const _authFlowPaths = ['/auth/login', '/auth/register', '/auth/refresh'];

  /// [multipart] takes a field name -> file path map for uploads; [token] overrides the stored
  /// session (used nowhere yet on mobile, kept for parity with the web client's enrollment-token
  /// support).
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? multipartFiles,
    String? token,
  }) async {
    final hadToken = (token ?? _accessToken) != null;

    Future<http.Response> doRequest() async {
      final effectiveToken = token ?? _accessToken;
      final uri = Uri.parse('$apiBaseUrl$path');
      if (multipartFiles != null) {
        final req = http.MultipartRequest(method, uri);
        if (effectiveToken != null) req.headers['Authorization'] = 'Bearer $effectiveToken';
        for (final entry in multipartFiles.entries) {
          req.files.add(await http.MultipartFile.fromPath(entry.key, entry.value));
        }
        final streamed = await req.send();
        return http.Response.fromStream(streamed);
      }
      final headers = <String, String>{};
      if (effectiveToken != null) headers['Authorization'] = 'Bearer $effectiveToken';
      if (body != null) headers['Content-Type'] = 'application/json';
      switch (method) {
        case 'POST':
          return http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        case 'PATCH':
          return http.patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        case 'DELETE':
          return http.delete(uri, headers: headers);
        default:
          return http.get(uri, headers: headers);
      }
    }

    var res = await doRequest();

    if (token == null && res.statusCode == 401 && _refreshToken != null) {
      if (await _tryRefresh()) res = await doRequest();
    }

    if (token == null && res.statusCode == 401 && hadToken && !_authFlowPaths.contains(path)) {
      await clearTokens();
      throw ApiException(401, 'Session expired.', code: 'UNAUTHENTICATED');
    }

    if (res.statusCode == 204) return null;

    final contentType = res.headers['content-type'] ?? '';
    final decoded = contentType.contains('application/json') && res.body.isNotEmpty ? jsonDecode(res.body) : null;

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final error = decoded?['error'] ?? {};
      throw ApiException(
        res.statusCode,
        error['message'] ?? 'Request failed (${res.statusCode})',
        code: error['code'],
        fields: Map<String, dynamic>.from(error['fields'] ?? {}),
      );
    }

    return decoded;
  }
}
