import 'package:flutter/material.dart';
import 'supplier_rfq_feed_screen.dart';
import 'supplier_offers_screen.dart';
import 'supplier_orders_screen.dart';
import '../profile_screen.dart';

class SupplierHomeShell extends StatefulWidget {
  const SupplierHomeShell({super.key});
  @override
  State<SupplierHomeShell> createState() => _SupplierHomeShellState();
}

class _SupplierHomeShellState extends State<SupplierHomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [const SupplierRfqFeedScreen(), const SupplierOffersScreen(), const SupplierOrdersScreen(), const ProfileScreen(role: 'supplier')];
    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description), label: 'RFQs'),
          NavigationDestination(icon: Icon(Icons.local_offer_outlined), selectedIcon: Icon(Icons.local_offer), label: 'Offers'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
