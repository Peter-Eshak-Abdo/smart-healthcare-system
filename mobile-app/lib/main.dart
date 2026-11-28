import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/config/firebase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('[FlutterError] ${details.exception.runtimeType}');
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[PlatformError] ${error.runtimeType}');
    return true;
  };

  try {
    await Hive.initFlutter();
  } catch (_) {}
  await FirebaseConfig.initializeSafely();
  runApp(
    const ProviderScope(
      child: SmartHealthApp(),
    ),
  );
}
