import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'supplier_rfq_detail_screen.dart';

class SupplierRfqFeedScreen extends StatefulWidget {
  const SupplierRfqFeedScreen({super.key});
  @override
  State<SupplierRfqFeedScreen> createState() => _SupplierRfqFeedScreenState();
}

class _SupplierRfqFeedScreenState extends State<SupplierRfqFeedScreen> {
  List<dynamic>? _rfqs;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/rfqs');
    if (mounted) setState(() => _rfqs = List<dynamic>.from(data['rfqs']));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Available RFQs')),
      body: _rfqs == null
          ? const LoadingCenter()
          : RefreshIndicator(
              onRefresh: _load,
              child: _rfqs!.isEmpty
                  ? const EmptyState('No RFQs available for your approved categories right now.')
                  : ListView.builder(
                      itemCount: _rfqs!.length,
                      itemBuilder: (context, i) {
                        final rfq = _rfqs![i];
                        return ListTile(
                          title: Text(rfq['title'] ?? ''),
                          subtitle: Text('${rfq['category_name'] ?? '—'} · ${rfq['buyer_general_region'] ?? '—'}'),
                          trailing: StatusBadge(rfq['status'] ?? ''),
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SupplierRfqDetailScreen(rfqId: rfq['id']))),
                        );
                      },
                    ),
            ),
    );
  }
}
