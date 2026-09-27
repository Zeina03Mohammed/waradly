import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';

class SupplierOrderDetailScreen extends StatefulWidget {
  final String orderId;
  const SupplierOrderDetailScreen({super.key, required this.orderId});

  @override
  State<SupplierOrderDetailScreen> createState() => _SupplierOrderDetailScreenState();
}

class _SupplierOrderDetailScreenState extends State<SupplierOrderDetailScreen> {
  Map<String, dynamic>? _order;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/orders/${widget.orderId}');
    if (mounted) setState(() => _order = data['order']);
  }

  Future<void> _act(String action, {String method = 'PATCH'}) async {
    setState(() => _error = null);
    try {
      await ApiClient.instance.request('/orders/${widget.orderId}/$action', method: method, body: method == 'POST' ? {} : null);
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_order == null) return const Scaffold(body: LoadingCenter());
    final status = _order!['status'];

    Widget? actionButton;
    if (status == 'PAYMENT_CONFIRMED') {
      actionButton = ElevatedButton(onPressed: () => _act('mark-production-started'), child: const Text('Mark production started'));
    } else if (status == 'PRODUCTION') {
      actionButton = _order!['sample_required'] == true
          ? ElevatedButton(onPressed: () => _act('samples', method: 'POST'), child: const Text('Submit sample for review'))
          : ElevatedButton(onPressed: () => _act('mark-production-completed'), child: const Text('Mark production completed'));
    }

    return Scaffold(
      appBar: AppBar(title: Text('Order ${widget.orderId}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ErrorText(_error),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Status', style: TextStyle(fontWeight: FontWeight.bold)), StatusBadge(status)]),
          const SizedBox(height: 8),
          Text('Sample required: ${_order!['sample_required'] == true ? 'Yes' : 'No'}'),
          const SizedBox(height: 16),
          ?actionButton,
        ],
      ),
    );
  }
}
