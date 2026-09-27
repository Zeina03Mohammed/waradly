import 'package:flutter/material.dart';
import '../theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: navy50, borderRadius: BorderRadius.circular(999)),
      child: Text(status, style: const TextStyle(fontSize: 12, color: navy700, fontWeight: FontWeight.w500)),
    );
  }
}

class ErrorText extends StatelessWidget {
  final String? message;
  const ErrorText(this.message, {super.key});

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    return Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(message!, style: const TextStyle(color: Colors.red)));
  }
}

class LoadingCenter extends StatelessWidget {
  const LoadingCenter({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}

class EmptyState extends StatelessWidget {
  final String message;
  const EmptyState(this.message, {super.key});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(message, style: const TextStyle(color: navy400))));
}

/// Firestore timestamps come back as {_seconds, _nanoseconds}; plain ISO strings show up too.
String formatDate(dynamic value) {
  if (value == null) return '—';
  DateTime? date;
  if (value is Map && value['_seconds'] != null) {
    date = DateTime.fromMillisecondsSinceEpoch((value['_seconds'] as int) * 1000);
  } else if (value is String) {
    date = DateTime.tryParse(value);
  }
  if (date == null) return '—';
  return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}
