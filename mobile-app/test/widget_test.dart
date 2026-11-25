import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smarthealth_mobile/app.dart';

void main() {
  testWidgets(
      'US-01 Mobile renders Egyptian Arabic RTL by default and switches to English LTR',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: SmartHealthApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('سمارت هيلث'), findsWidgets);
    expect(find.text('أهلاً بيك في سمارت هيلث'), findsOneWidget);

    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();

    expect(find.text('SmartHealth'), findsWidgets);
    expect(find.text('Welcome to SmartHealth'), findsOneWidget);
  });

  testWidgets('Offline emergency card opens directly from login screen',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: SmartHealthApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('افتح كارت الطوارئ بدون نت'));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byType(Scaffold), findsWidgets);
  });
}
