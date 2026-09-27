import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'supplier_offer_form_screen.dart';

class SupplierRfqDetailScreen extends StatefulWidget {
  final String rfqId;
  const SupplierRfqDetailScreen({super.key, required this.rfqId});

  @override
  State<SupplierRfqDetailScreen> createState() => _SupplierRfqDetailScreenState();
}

class _SupplierRfqDetailScreenState extends State<SupplierRfqDetailScreen> {
  Map<String, dynamic>? _rfq;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/rfqs/${widget.rfqId}');
    if (mounted) setState(() => _rfq = data['rfq']);
  }

  @override
  Widget build(BuildContext context) {
    if (_rfq == null) return const Scaffold(body: LoadingCenter());
    final status = _rfq!['status'];
    final canOffer = ['PUBLISHED', 'RECEIVING_OFFERS'].contains(status);

    return Scaffold(
      appBar: AppBar(title: Text(_rfq!['title'] ?? '')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Expanded(child: Text(_rfq!['title'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold))), StatusBadge(status)]),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Buyer: ${_rfq!['buyer_display_name'] ?? 'Buyer'} (${_rfq!['buyer_general_region'] ?? '—'})'),
                Text('Category: ${_rfq!['category_name'] ?? '—'}'),
                Text('Quantity: ${_rfq!['quantity'] ?? '—'} ${_rfq!['unit'] ?? ''}'),
                Text('Delivery region: ${_rfq!['delivery_region'] ?? '—'}'),
                Text('Sample required: ${_rfq!['sample_required'] == true ? 'Yes' : 'No'}'),
                if (_rfq!['quality_requirements'] != null) Text('Quality requirements: ${_rfq!['quality_requirements']}'),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          if (canOffer)
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SupplierOfferFormScreen(rfqId: widget.rfqId))),
              child: const Text('Submit an offer'),
            ),
        ],
      ),
    );
  }
}
