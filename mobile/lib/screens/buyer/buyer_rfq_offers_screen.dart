import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'buyer_order_detail_screen.dart';

class BuyerRfqOffersScreen extends StatefulWidget {
  final String rfqId;
  const BuyerRfqOffersScreen({super.key, required this.rfqId});

  @override
  State<BuyerRfqOffersScreen> createState() => _BuyerRfqOffersScreenState();
}

class _BuyerRfqOffersScreenState extends State<BuyerRfqOffersScreen> {
  List<dynamic>? _offers;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/rfqs/${widget.rfqId}/offers');
    if (mounted) setState(() => _offers = List<dynamic>.from(data['offers']));
  }

  Future<void> _accept(String offerId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Accept this offer?'),
        content: const Text('This will reject all other offers and create an order.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Accept')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final data = await ApiClient.instance.request('/offers/$offerId/accept', method: 'PATCH');
      if (mounted) Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => BuyerOrderDetailScreen(orderId: data['order_id'])));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compare offers')),
      body: _offers == null
          ? const LoadingCenter()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ErrorText(_error),
                if (_offers!.isEmpty) const EmptyState('No offers yet.'),
                ..._offers!.map((o) => Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(o['supplier_anonymized_id'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)), StatusBadge(o['status'] ?? '')]),
                          const SizedBox(height: 4),
                          Text('Unit price: \$${o['unit_price']}  ·  MOQ: ${o['moq']}'),
                          Text('Lead time: ${o['production_lead_time_days']}d  ·  Delivery est: ${o['delivery_time_estimate_days']}d'),
                          if (['SUBMITTED', 'UNDER_REVIEW'].contains(o['status'])) ...[
                            const SizedBox(height: 8),
                            ElevatedButton(onPressed: () => _accept(o['id']), child: const Text('Accept')),
                          ],
                        ]),
                      ),
                    )),
              ],
            ),
    );
  }
}
