import 'package:flutter/material.dart';
import '../api_client.dart';
import '../auth_service.dart';
import '../widgets/common.dart';
import '../main.dart';

class ProfileScreen extends StatefulWidget {
  final String role; // 'buyer' | 'supplier' | 'admin'
  const ProfileScreen({super.key, required this.role});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _username = TextEditingController();
  final _legalName = TextEditingController();
  final _country = TextEditingController();
  final _generalRegion = TextEditingController();
  final _taxId = TextEditingController();
  bool _loading = true;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    _username.text = AuthService.instance.currentUser?['username'] ?? '';
    if (widget.role != 'admin') {
      try {
        final data = await ApiClient.instance.request('/organizations/me');
        final org = data['organization'];
        _legalName.text = org['legal_name'] ?? '';
        _country.text = org['country'] ?? '';
        _generalRegion.text = org['general_region'] ?? '';
        _taxId.text = org['tax_id'] ?? '';
      } catch (_) {
        // no organization yet — nothing to prefill
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _saveUsername() async {
    setState(() {
      _error = null;
      _success = null;
    });
    try {
      await ApiClient.instance.request('/users/me', method: 'PATCH', body: {'username': _username.text});
      setState(() => _success = 'Saved.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _saveOrg() async {
    setState(() {
      _error = null;
      _success = null;
    });
    try {
      await ApiClient.instance.request('/organizations/me', method: 'PATCH', body: {
        'legal_name': _legalName.text,
        'country': _country.text,
        'general_region': _generalRegion.text,
        'tax_id': _taxId.text.isEmpty ? null : _taxId.text,
      });
      setState(() => _success = 'Profile updated.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _logout() async {
    await AuthService.instance.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const WaradlyApp()), (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingCenter());
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ErrorText(_error),
          if (_success != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_success!, style: const TextStyle(color: Colors.green))),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(controller: _username, decoration: const InputDecoration(labelText: 'Username')),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _saveUsername, child: const Text('Save username')),
                ],
              ),
            ),
          ),
          if (widget.role != 'admin') ...[
            const SizedBox(height: 16),
            const Text('Company Profile', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(controller: _legalName, decoration: const InputDecoration(labelText: 'Legal name')),
                    const SizedBox(height: 8),
                    TextField(controller: _country, decoration: const InputDecoration(labelText: 'Country')),
                    const SizedBox(height: 8),
                    TextField(controller: _generalRegion, decoration: const InputDecoration(labelText: 'General region')),
                    const SizedBox(height: 8),
                    TextField(controller: _taxId, decoration: const InputDecoration(labelText: 'Tax ID (optional)')),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _saveOrg, child: const Text('Save changes')),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),
          OutlinedButton(onPressed: _logout, child: const Text('Log out')),
        ],
      ),
    );
  }
}
