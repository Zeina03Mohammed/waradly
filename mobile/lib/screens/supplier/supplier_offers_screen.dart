import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'supplier_offer_form_screen.dart';

class SupplierOffersScreen extends StatefulWidget {
  const SupplierOffersScreen({super.key});
  @override
  State<SupplierOffersScreen> createState() => _SupplierOffersScreenState();
}

class _SupplierOffersScreenState extends State<SupplierOffersScreen> {
  List<dynamic>? _offers;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/offers');
    if (mounted) setState(() => _offers = List<dynamic>.from(data['offers']));
  }

  Future<void> _withdraw(String id) async {
    setState(() => _error = null);
    try {
      await ApiClient.instance.request('/offers/$id/withdraw', method: 'PATCH');
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Offers')),
      body: _offers == null
          ? const LoadingCenter()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  ErrorText(_error),
                  if (_offers!.isEmpty) const EmptyState('No offers yet.'),
                  ..._offers!.map((o) {
                    final editable = ['SUBMITTED', 'UNDER_REVIEW'].contains(o['status']);
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('\$${o['unit_price']} · MOQ ${o['moq']}'), StatusBadge(o['status'] ?? '')]),
                          if (editable) ...[
                            const SizedBox(height: 8),
                            Row(children: [
                              TextButton(
                                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SupplierOfferFormScreen(offerId: o['id']))).then((_) => _load()),
                                child: const Text('Edit'),
                              ),
                              TextButton(onPressed: () => _withdraw(o['id']), style: TextButton.styleFrom(foregroundColor: Colors.red), child: const Text('Withdraw')),
                            ]),
                          ],
                        ]),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
