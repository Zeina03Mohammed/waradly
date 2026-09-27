import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'supplier_order_detail_screen.dart';

class SupplierOrdersScreen extends StatefulWidget {
  const SupplierOrdersScreen({super.key});
  @override
  State<SupplierOrdersScreen> createState() => _SupplierOrdersScreenState();
}

class _SupplierOrdersScreenState extends State<SupplierOrdersScreen> {
  List<dynamic>? _orders;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/orders');
    if (mounted) setState(() => _orders = List<dynamic>.from(data['orders']));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      body: _orders == null
          ? const LoadingCenter()
          : RefreshIndicator(
              onRefresh: _load,
              child: _orders!.isEmpty
                  ? const EmptyState('No orders yet.')
                  : ListView.builder(
                      itemCount: _orders!.length,
                      itemBuilder: (context, i) {
                        final order = _orders![i];
                        return ListTile(
                          title: Text('Order ${order['id']}'),
                          trailing: StatusBadge(order['status'] ?? ''),
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SupplierOrderDetailScreen(orderId: order['id']))).then((_) => _load()),
                        );
                      },
                    ),
            ),
    );
  }
}
