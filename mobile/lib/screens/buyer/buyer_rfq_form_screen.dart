import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';

class BuyerRfqFormScreen extends StatefulWidget {
  final String? rfqId; // null = create
  const BuyerRfqFormScreen({super.key, this.rfqId});

  @override
  State<BuyerRfqFormScreen> createState() => _BuyerRfqFormScreenState();
}

class _BuyerRfqFormScreenState extends State<BuyerRfqFormScreen> {
  final _title = TextEditingController();
  final _category = TextEditingController();
  final _quantity = TextEditingController();
  final _unit = TextEditingController();
  final _deliveryRegion = TextEditingController();
  DateTime? _deliveryDeadline;
  DateTime? _offerDeadline;
  bool _sampleRequired = false;
  bool _loading = false;
  bool _editable = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.rfqId != null) _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final data = await ApiClient.instance.request('/rfqs/${widget.rfqId}');
    final rfq = data['rfq'];
    _title.text = rfq['title'] ?? '';
    _category.text = rfq['category_name'] ?? '';
    _quantity.text = rfq['quantity']?.toString() ?? '';
    _unit.text = rfq['unit'] ?? '';
    _deliveryRegion.text = rfq['delivery_region'] ?? '';
    _sampleRequired = rfq['sample_required'] == true;
    _editable = ['DRAFT', 'SUBMITTED'].contains(rfq['status']);
    if (mounted) setState(() => _loading = false);
  }

  Map<String, dynamic> _payload() => {
        'title': _title.text,
        if (_category.text.isNotEmpty) 'category': _category.text,
        if (_quantity.text.isNotEmpty) 'quantity': double.tryParse(_quantity.text),
        if (_unit.text.isNotEmpty) 'unit': _unit.text,
        if (_deliveryRegion.text.isNotEmpty) 'delivery_region': _deliveryRegion.text,
        if (_deliveryDeadline != null) 'delivery_deadline': _deliveryDeadline!.toIso8601String(),
        if (_offerDeadline != null) 'offer_deadline_at': _offerDeadline!.toIso8601String(),
        'sample_required': _sampleRequired,
      };

  Future<void> _pickDate(bool isDelivery) async {
    final picked = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 730)));
    if (picked == null) return;
    setState(() => isDelivery ? _deliveryDeadline = picked : _offerDeadline = picked);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    try {
      if (widget.rfqId == null) {
        final data = await ApiClient.instance.request('/rfqs', method: 'POST', body: _payload());
        if (mounted) Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => BuyerRfqFormScreen(rfqId: data['rfq']['id'])));
      } else {
        await ApiClient.instance.request('/rfqs/${widget.rfqId}', method: 'PATCH', body: _payload());
        if (mounted) Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _submitForReview() async {
    setState(() => _error = null);
    try {
      await ApiClient.instance.request('/rfqs/${widget.rfqId}', method: 'PATCH', body: _payload());
      await ApiClient.instance.request('/rfqs/${widget.rfqId}/submit', method: 'PATCH');
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingCenter());
    return Scaffold(
      appBar: AppBar(title: Text(widget.rfqId == null ? 'Create RFQ' : 'Edit RFQ')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ErrorText(_error),
          TextField(controller: _title, enabled: _editable, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 8),
          TextField(controller: _category, enabled: _editable, decoration: const InputDecoration(labelText: 'Category')),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(controller: _quantity, enabled: _editable, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: _unit, enabled: _editable, decoration: const InputDecoration(labelText: 'Unit'))),
          ]),
          const SizedBox(height: 8),
          TextField(controller: _deliveryRegion, enabled: _editable, decoration: const InputDecoration(labelText: 'Delivery region')),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(_deliveryDeadline == null ? 'Delivery deadline' : formatDate(_deliveryDeadline!.toIso8601String())),
            trailing: const Icon(Icons.calendar_today, size: 18),
            onTap: _editable ? () => _pickDate(true) : null,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(_offerDeadline == null ? 'Offer deadline' : formatDate(_offerDeadline!.toIso8601String())),
            trailing: const Icon(Icons.calendar_today, size: 18),
            onTap: _editable ? () => _pickDate(false) : null,
          ),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _sampleRequired, onChanged: _editable ? (v) => setState(() => _sampleRequired = v) : null, title: const Text('Sample required')),
          const SizedBox(height: 16),
          if (_editable) ElevatedButton(onPressed: _save, child: Text(widget.rfqId == null ? 'Save draft' : 'Save changes')),
          if (_editable && widget.rfqId != null) ...[
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _submitForReview, child: const Text('Submit for review')),
          ],
          if (!_editable) const Text('This RFQ can no longer be edited.', style: TextStyle(color: Colors.red)),
        ],
      ),
    );
  }
}
