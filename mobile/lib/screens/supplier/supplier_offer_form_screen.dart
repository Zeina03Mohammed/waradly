import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../widgets/common.dart';

class SupplierOfferFormScreen extends StatefulWidget {
  final String? rfqId; // required for create
  final String? offerId; // set for edit
  const SupplierOfferFormScreen({super.key, this.rfqId, this.offerId});

  @override
  State<SupplierOfferFormScreen> createState() => _SupplierOfferFormScreenState();
}

class _SupplierOfferFormScreenState extends State<SupplierOfferFormScreen> {
  final _unitPrice = TextEditingController();
  final _moq = TextEditingController();
  final _leadTime = TextEditingController();
  final _deliveryEstimate = TextEditingController();
  bool _sampleAvailability = false;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.offerId != null) _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final data = await ApiClient.instance.request('/offers/${widget.offerId}');
    final offer = data['offer'];
    _unitPrice.text = offer['unit_price'].toString();
    _moq.text = offer['moq'].toString();
    _leadTime.text = offer['production_lead_time_days'].toString();
    _deliveryEstimate.text = offer['delivery_time_estimate_days'].toString();
    _sampleAvailability = offer['sample_availability'] == true;
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    final payload = {
      'unit_price': double.tryParse(_unitPrice.text),
      'moq': double.tryParse(_moq.text),
      'production_lead_time_days': int.tryParse(_leadTime.text),
      'delivery_time_estimate_days': int.tryParse(_deliveryEstimate.text),
      'sample_availability': _sampleAvailability,
    };
    try {
      if (widget.offerId != null) {
        await ApiClient.instance.request('/offers/${widget.offerId}', method: 'PATCH', body: payload);
      } else {
        await ApiClient.instance.request('/rfqs/${widget.rfqId}/offers', method: 'POST', body: payload);
      }
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingCenter());
    return Scaffold(
      appBar: AppBar(title: Text(widget.offerId != null ? 'Edit offer' : 'Submit an offer')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ErrorText(_error),
          TextField(controller: _unitPrice, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Unit price (\$)')),
          const SizedBox(height: 8),
          TextField(controller: _moq, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'MOQ')),
          const SizedBox(height: 8),
          TextField(controller: _leadTime, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Production lead time (days)')),
          const SizedBox(height: 8),
          TextField(controller: _deliveryEstimate, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Delivery estimate (days)')),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _sampleAvailability, onChanged: (v) => setState(() => _sampleAvailability = v), title: const Text('Sample available')),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _submit, child: Text(widget.offerId != null ? 'Save changes' : 'Submit offer')),
        ],
      ),
    );
  }
}
