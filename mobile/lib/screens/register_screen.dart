import 'package:flutter/material.dart';
import '../api_client.dart';
import '../theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  String _role = 'buyer';
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  final _legalName = TextEditingController();
  final _country = TextEditingController();
  final _generalRegion = TextEditingController();
  bool _termsAccepted = false;
  String? _error;
  bool _submitting = false;
  bool _success = false;

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_password.text != _confirmPassword.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    setState(() => _submitting = true);
    try {
      await ApiClient.instance.request('/auth/register', method: 'POST', body: {
        'email': _email.text.trim(),
        'username': _username.text.trim(),
        'phone': _phone.text.trim(),
        'password': _password.text,
        'role': _role,
        'legal_name': _legalName.text.trim(),
        'country': _country.text.trim(),
        'general_region': _generalRegion.text.trim(),
        'terms_accepted': _termsAccepted,
      });
      // Note: registration returns real tokens immediately (see functions/routes/auth.routes.js)
      // so the account IS usable right away — but we don't auto-login here, since email
      // verification is still required before /auth/login succeeds. The WebAuthn "Face ID"
      // step the web client offers suppliers here is a web-only UX flow, not a backend
      // requirement (nothing in /auth/login checks for a credential) — safe to skip on mobile.
      setState(() => _success = true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_success) {
      return Scaffold(
        appBar: AppBar(title: const Text('Check your email')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Your account was created. We sent a verification link to ${_email.text}. Once verified you can log in.'),
              if (_role == 'supplier') ...[
                const SizedBox(height: 12),
                const Text(
                  'Tip: on the Waradly website you can also complete a one-time Face ID identity check for supplier accounts.',
                  style: TextStyle(color: navy400),
                ),
              ],
              const SizedBox(height: 20),
              ElevatedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Back to login')),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Create an account')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'buyer', label: Text('Buyer')), ButtonSegment(value: 'supplier', label: Text('Supplier'))],
              selected: {_role},
              onSelectionChanged: (s) => setState(() => _role = s.first),
            ),
            const SizedBox(height: 16),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
            TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 8),
            TextField(controller: _username, decoration: const InputDecoration(labelText: 'Username')),
            const SizedBox(height: 8),
            TextField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone number')),
            const SizedBox(height: 8),
            TextField(controller: _password, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            const SizedBox(height: 8),
            TextField(controller: _confirmPassword, decoration: const InputDecoration(labelText: 'Confirm password'), obscureText: true),
            const SizedBox(height: 8),
            TextField(controller: _legalName, decoration: const InputDecoration(labelText: 'Company legal name')),
            const SizedBox(height: 8),
            TextField(controller: _country, decoration: const InputDecoration(labelText: 'Country')),
            const SizedBox(height: 8),
            TextField(controller: _generalRegion, decoration: const InputDecoration(labelText: 'General region')),
            const SizedBox(height: 12),
            CheckboxListTile(
              value: _termsAccepted,
              onChanged: (v) => setState(() => _termsAccepted = v ?? false),
              title: const Text('I confirm I am at least 18 years old and registering on behalf of a business, and I agree to the Terms, Anti-Circumvention Policy, and Privacy Policy.'),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Create account'),
            ),
          ],
        ),
      ),
    );
  }
}
