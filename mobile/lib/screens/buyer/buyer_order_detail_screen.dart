import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';

class BuyerOrderDetailScreen extends StatefulWidget {
  final String orderId;
  const BuyerOrderDetailScreen({super.key, required this.orderId});

  @override
  State<BuyerOrderDetailScreen> createState() => _BuyerOrderDetailScreenState();
}

class _BuyerOrderDetailScreenState extends State<BuyerOrderDetailScreen> {
  Map<String, dynamic>? _order;
  List<dynamic> _history = [];
  String? _error;
  final _scoreController = TextEditingController(text: '5');
  final _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.request('/orders/${widget.orderId}');
    if (mounted) {
      setState(() {
        _order = data['order'];
        _history = List<dynamic>.from(data['status_history'] ?? []);
      });
    }
  }

  Future<void> _decideSample(bool approved) async {
    setState(() => _error = null);
    try {
      await ApiClient.instance.request('/orders/${widget.orderId}/samples/decision', method: 'PATCH', body: {'approved': approved});
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _rate() async {
    setState(() => _error = null);
    try {
      await ApiClient.instance.request('/orders/${widget.orderId}/rate', method: 'POST', body: {
        'score': int.tryParse(_scoreController.text) ?? 5,
        if (_commentController.text.isNotEmpty) 'comment': _commentController.text,
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _reorder() async {
    setState(() => _error = null);
    try {
      await ApiClient.instance.request('/orders/${widget.orderId}/reorder', method: 'POST');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('A new draft RFQ was created — edit it from My RFQs.')));
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_order == null) return const Scaffold(body: LoadingCenter());
    final status = _order!['status'];

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
          if (status == 'SAMPLE_REVIEW') ...[
            const Text('Sample review', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: ElevatedButton(onPressed: () => _decideSample(true), child: const Text('Approve'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: () => _decideSample(false), style: OutlinedButton.styleFrom(foregroundColor: Colors.red), child: const Text('Reject'))),
            ]),
            const SizedBox(height: 16),
          ],
          if (['DELIVERED', 'COMPLETED'].contains(status)) ...[
            const Text('Rate this order', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(controller: _scoreController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Score (1-5)')),
            const SizedBox(height: 8),
            TextField(controller: _commentController, decoration: const InputDecoration(labelText: 'Comment (optional)')),
            const SizedBox(height: 8),
            ElevatedButton(onPressed: _rate, child: const Text('Submit rating')),
            const SizedBox(height: 16),
          ],
          if (status == 'COMPLETED') OutlinedButton(onPressed: _reorder, child: const Text('Reorder')),
          const SizedBox(height: 16),
          const Text('History', style: TextStyle(fontWeight: FontWeight.w600)),
          ..._history.map((h) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text('${h['from_status'] != null ? '${h['from_status']} → ' : ''}${h['to_status']} — ${formatDate(h['changed_at'])}'),
              )),
        ],
      ),
    );
  }
}
