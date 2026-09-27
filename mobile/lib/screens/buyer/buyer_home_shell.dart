import 'package:flutter/material.dart';
import 'buyer_dashboard_screen.dart';
import 'buyer_rfq_list_screen.dart';
import 'buyer_orders_screen.dart';
import '../profile_screen.dart';

class BuyerHomeShell extends StatefulWidget {
  const BuyerHomeShell({super.key});
  @override
  State<BuyerHomeShell> createState() => _BuyerHomeShellState();
}

class _BuyerHomeShellState extends State<BuyerHomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [const BuyerDashboardScreen(), const BuyerRfqListScreen(), const BuyerOrdersScreen(), const ProfileScreen(role: 'buyer')];
    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description), label: 'RFQs'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
