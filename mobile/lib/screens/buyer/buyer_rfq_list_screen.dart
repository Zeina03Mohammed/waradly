import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'buyer_rfq_form_screen.dart';
import 'buyer_rfq_detail_screen.dart';

class BuyerRfqListScreen extends StatefulWidget {
  const BuyerRfqListScreen({super.key});
  @override
  State<BuyerRfqListScreen> createState() => _BuyerRfqListScreenState();
}

class _BuyerRfqListScreenState extends State<BuyerRfqListScreen> {
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
      appBar: AppBar(title: const Text('My RFQs')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BuyerRfqFormScreen())).then((_) => _load()),
        child: const Icon(Icons.add),
      ),
      body: _rfqs == null
          ? const LoadingCenter()
          : RefreshIndicator(
              onRefresh: _load,
              child: _rfqs!.isEmpty
                  ? const EmptyState('No RFQs yet.')
                  : ListView.builder(
                      itemCount: _rfqs!.length,
                      itemBuilder: (context, i) {
                        final rfq = _rfqs![i];
                        return ListTile(
                          title: Text(rfq['title'] ?? ''),
                          subtitle: Text(rfq['category_name'] ?? '—'),
                          trailing: StatusBadge(rfq['status'] ?? ''),
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BuyerRfqDetailScreen(rfqId: rfq['id']))).then((_) => _load()),
                        );
                      },
                    ),
            ),
    );
  }
}
