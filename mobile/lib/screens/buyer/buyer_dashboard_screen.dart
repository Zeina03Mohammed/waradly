import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';
import 'buyer_rfq_form_screen.dart';
import 'buyer_rfq_detail_screen.dart';

class BuyerDashboardScreen extends StatefulWidget {
  const BuyerDashboardScreen({super.key});
  @override
  State<BuyerDashboardScreen> createState() => _BuyerDashboardScreenState();
}

class _BuyerDashboardScreenState extends State<BuyerDashboardScreen> {
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
      appBar: AppBar(title: const Text('Dashboard')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BuyerRfqFormScreen())).then((_) => _load()),
        label: const Text('Create RFQ'),
        icon: const Icon(Icons.add),
      ),
      body: _rfqs == null
          ? const LoadingCenter()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(child: _StatCard(label: 'Open RFQs', value: _rfqs!.where((r) => !['CLOSED', 'CANCELLED', 'REJECTED'].contains(r['status'])).length.toString())),
                      const SizedBox(width: 12),
                      Expanded(child: _StatCard(label: 'Total RFQs', value: _rfqs!.length.toString())),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text('Recent RFQs', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (_rfqs!.isEmpty) const EmptyState('No RFQs yet — create your first one.'),
                  ..._rfqs!.take(5).map((rfq) => Card(
                        child: ListTile(
                          title: Text(rfq['title'] ?? ''),
                          trailing: StatusBadge(rfq['status'] ?? ''),
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BuyerRfqDetailScreen(rfqId: rfq['id']))).then((_) => _load()),
                        ),
                      )),
                ],
              ),
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  const _StatCard({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        ]),
      ),
    );
  }
}
