import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/app_providers.dart';
import '../data/patient_repository.dart';

class PatientOnboardingScreen extends ConsumerStatefulWidget {
  const PatientOnboardingScreen({super.key});

  @override
  ConsumerState<PatientOnboardingScreen> createState() =>
      _PatientOnboardingScreenState();
}

class _PatientOnboardingScreenState
    extends ConsumerState<PatientOnboardingScreen> {
  final TextEditingController _nationalIdCtrl = TextEditingController();
  final TextEditingController _dobCtrl = TextEditingController(text: '1990-01-15');
  String _sex = 'male';
  String _bloodType = 'O+';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nationalIdCtrl.dispose();
    _dobCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final PatientRepository repo = PatientRepository(
        api: ref.read(apiClientProvider),
        encryptedStorage: ref.read(encryptedStorageProvider),
      );
      await repo.submitOnboarding(
        idDocumentNumber: _nationalIdCtrl.text.trim(),
        dateOfBirthIso: _dobCtrl.text.trim(),
        sex: _sex,
        bloodType: _bloodType,
      );
      if (mounted) context.go('/p/home');
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('SmartHealth Onboarding')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsetsDirectional.all(20),
          children: <Widget>[
            if (_error != null)
              Padding(
                padding: const EdgeInsetsDirectional.only(bottom: 12),
                child: Text(_error!),
              ),
            TextField(
              controller: _nationalIdCtrl,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(labelText: 'National ID (14 digits)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _dobCtrl,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(labelText: 'Date of Birth (YYYY-MM-DD)'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _sex,
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem<String>(value: 'male', child: Text('Male')),
                DropdownMenuItem<String>(value: 'female', child: Text('Female')),
              ],
              onChanged: (String? v) => setState(() => _sex = v ?? 'male'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _bloodType,
              items: const <String>[
                'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'
              ]
                  .map(
                    (String b) => DropdownMenuItem<String>(
                      value: b,
                      child: Text(b),
                    ),
                  )
                  .toList(),
              onChanged: (String? v) => setState(() => _bloodType = v ?? 'O+'),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: const Text('Complete Profile'),
            ),
          ],
        ),
      ),
    );
  }
}
