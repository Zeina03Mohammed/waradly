import 'api_client.dart';

/// Plain singleton, no external state-management package — mirrors the web client's
/// AuthProvider.tsx closely enough for an app this size. Role/ownership are still enforced
/// server-side on every request; screens only use this for UX (which screen to show), same
/// disclaimer as the web's useRequireRole.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  Map<String, dynamic>? currentUser;

  Future<Map<String, dynamic>?> fetchCurrentUser() async {
    await ApiClient.instance.loadTokens();
    if (!ApiClient.instance.isLoggedIn) {
      currentUser = null;
      return null;
    }
    try {
      final data = await ApiClient.instance.request('/users/me');
      currentUser = data['user'];
      return currentUser;
    } catch (_) {
      currentUser = null;
      return null;
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await ApiClient.instance.request('/auth/login', method: 'POST', body: {'email': email, 'password': password});
    await ApiClient.instance.setTokens(data['access_token'], data['refresh_token']);
    currentUser = data['user'];
    return currentUser!;
  }

  Future<void> logout() async {
    try {
      await ApiClient.instance.request('/auth/logout', method: 'POST');
    } catch (_) {
      // ignore — clear local tokens regardless
    }
    await ApiClient.instance.clearTokens();
    currentUser = null;
  }
}
