import 'package:flutter/material.dart';
import 'theme.dart';
import 'auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/buyer/buyer_home_shell.dart';
import 'screens/supplier/supplier_home_shell.dart';

void main() {
  runApp(const WaradlyApp());
}

class WaradlyApp extends StatelessWidget {
  const WaradlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Waradly',
      theme: waradlyTheme,
      debugShowCheckedModeBanner: false,
      home: const _RootRouter(),
      routes: {'/register': (_) => const RegisterScreen()},
    );
  }
}

/// Decides Login vs the role's home shell once at startup based on stored tokens — same job
/// AuthProvider.tsx's initial refreshUser() does on the web.
class _RootRouter extends StatefulWidget {
  const _RootRouter();
  @override
  State<_RootRouter> createState() => _RootRouterState();
}

class _RootRouterState extends State<_RootRouter> {
  bool _loading = true;
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = await AuthService.instance.fetchCurrentUser();
    if (!mounted) return;
    setState(() {
      _user = user;
      _loading = false;
    });
  }

  void _onLoggedIn(Map<String, dynamic> user) {
    setState(() => _user = user);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_user == null) return LoginScreen(onLoggedIn: _onLoggedIn);
    if (_user!['role'] == 'supplier') return const SupplierHomeShell();
    return const BuyerHomeShell();
  }
}
