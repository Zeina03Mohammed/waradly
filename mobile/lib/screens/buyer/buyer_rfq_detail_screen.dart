import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'buyer_rfq_form_screen.dart';
import 'buyer_rfq_offers_screen.dart';

class BuyerRfqDetailScreen extends StatefulWidget {
  final String rfqId;
  const BuyerRfqDetailScreen({super.key, required this.rfqId});

  @override
  State<BuyerRfqDetailScreen> createState() => _BuyerRfqDetailScreenState();
}

class _BuyerRfqDetailScreenState extends State<BuyerRfqDetailScreen> {
  Map<String, dynamic>? _rfq;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/rfqs/${widget.rfqId}');
    if (mounted) setState(() => _rfq = data['rfq']);
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this RFQ?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes, cancel')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ApiClient.instance.request('/rfqs/${widget.rfqId}/cancel', method: 'PATCH');
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_rfq == null) return const Scaffold(body: LoadingCenter());
    final status = _rfq!['status'];
    final canEdit = ['DRAFT', 'SUBMITTED'].contains(status);
    final canCancel = !['AWARDED', 'CLOSED', 'CANCELLED', 'EXPIRED'].contains(status);
    final canViewOffers = ['PUBLISHED', 'RECEIVING_OFFERS', 'AWARDED'].contains(status);

    return Scaffold(
      appBar: AppBar(title: Text(_rfq!['title'] ?? '')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ErrorText(_error),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(_rfq!['title'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)), StatusBadge(status)]),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Category: ${_rfq!['category_name'] ?? '—'}'),
                Text('Quantity: ${_rfq!['quantity'] ?? '—'} ${_rfq!['unit'] ?? ''}'),
                Text('Delivery region: ${_rfq!['delivery_region'] ?? '—'}'),
                Text('Sample required: ${_rfq!['sample_required'] == true ? 'Yes' : 'No'}'),
                if (_rfq!['rejection_reason'] != null) Text('Rejection reason: ${_rfq!['rejection_reason']}', style: const TextStyle(color: Colors.red)),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          if (canEdit)
            OutlinedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BuyerRfqFormScreen(rfqId: widget.rfqId))).then((_) => _load()),
              child: const Text('Edit'),
            ),
          if (canViewOffers)
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BuyerRfqOffersScreen(rfqId: widget.rfqId))).then((_) => _load()),
              child: const Text('View offers'),
            ),
          if (canCancel) TextButton(onPressed: _cancel, style: TextButton.styleFrom(foregroundColor: Colors.red), child: const Text('Cancel RFQ')),
        ],
      ),
    );
  }
}
