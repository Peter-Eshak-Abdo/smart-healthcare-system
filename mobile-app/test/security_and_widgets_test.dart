import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smarthealth_mobile/core/theme/app_theme.dart';
import 'package:smarthealth_mobile/core/theme/sh_colors.dart';
import 'package:smarthealth_mobile/core/widgets/ai_orb.dart';
import 'package:smarthealth_mobile/core/widgets/face_mesh_scanner.dart';
import 'package:smarthealth_mobile/core/widgets/medical_id_card_3d.dart';
import 'package:smarthealth_mobile/core/widgets/sh_bdi.dart';

void main() {
  test('AppTheme supports Light, Dark, Emergency, and Sunlight modes + Large Font', () {
    for (final ShThemeMode mode in ShThemeMode.values) {
      final ThemeData normal = AppTheme.build(mode);
      final ThemeData large = AppTheme.build(mode, largeFont: true);
      expect(normal.extension<ShColors>(), isNotNull);
      expect(large.textTheme.bodyMedium!.fontSize!,
          greaterThan(normal.textTheme.bodyMedium!.fontSize!));
    }
  });

  testWidgets('MedicalIdCard3D & FaceMeshScanner & AiOrb render cleanly in Emergency mode',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(ShThemeMode.emergency),
        home: const Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: <Widget>[
                MedicalIdCard3D(
                  fullName: 'سارة علي',
                  mrn: 'SH-EG-000102',
                  bloodType: 'O+',
                  allergies: <String>['Penicillin (severe)'],
                  qrPayload: 'SHEC1.test.payload',
                  emergencyMode: true,
                ),
                FaceMeshScanner(
                  hint: 'حرّك راسك يمين بسيط',
                  emergency: true,
                ),
                AiOrb(state: AiOrbState.emergency),
                ShBdi('RX-2026-000101'),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('SH-EG-000102'), findsOneWidget);
    expect(find.text('O+'), findsOneWidget);
    expect(find.text('Penicillin (severe)'), findsOneWidget);
    expect(find.text('RX-2026-000101'), findsOneWidget);
  });
}
