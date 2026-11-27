import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/services/haptic_service.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/ai_orb.dart';
import '../../../l10n/app_localizations.dart';
import '../data/patient_repository.dart';

class _ChatEntry {
  const _ChatEntry({
    required this.isUser,
    required this.text,
    this.specialty,
    this.redFlag = false,
    this.followUps = const <String>[],
  });

  final bool isUser;
  final String text;
  final String? specialty;
  final bool redFlag;
  final List<String> followUps;
}

class AiAssistantScreen extends ConsumerStatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  ConsumerState<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends ConsumerState<AiAssistantScreen> {
  final TextEditingController _inputCtrl = TextEditingController();
  final List<_ChatEntry> _messages = <_ChatEntry>[];
  String? _sessionId;
  bool _sending = false;
  bool _redFlagTakeover = false;

  PatientRepository get _repo => PatientRepository(
        api: ref.read(apiClientProvider),
        encryptedStorage: ref.read(encryptedStorageProvider),
      );

  @override
  void dispose() {
    _inputCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final String text = _inputCtrl.text.trim();
    if (text.isEmpty || _sending) return;

    _inputCtrl.clear();
    setState(() {
      _messages.add(_ChatEntry(isUser: true, text: text));
      _sending = true;
    });

    try {
      final String locale = ref.read(localeProvider).languageCode;
      _sessionId ??=
          (await _repo.createAssistantSession(locale))['session_id']?.toString();
      if (_sessionId == null) return;

      final Map<String, Object?> res = await _repo.sendAssistantMessage(
        sessionId: _sessionId!,
        text: text,
        clientMessageId:
            '00000000-0000-4000-8000-${DateTime.now().microsecondsSinceEpoch.toString().padLeft(12, '0').substring(0, 12)}',
      );

      final Object? triageRaw = res['triage'];
      final bool isRedFlag = triageRaw is Map<Object?, Object?> &&
          triageRaw['red_flag'] == true;
      final Object? replyRaw = res['reply'];
      final String replyText = replyRaw is Map<Object?, Object?>
          ? (replyRaw['text']?.toString() ?? '')
          : '';
      final Object? specRaw = res['recommended_specialty'];
      String? specLabel;
      if (specRaw is Map<Object?, Object?>) {
        final Object? nameRaw = specRaw['name'];
        if (nameRaw is Map<Object?, Object?>) {
          specLabel = nameRaw[locale]?.toString() ?? nameRaw['en']?.toString();
        }
      }

      final List<String> followUps = res['follow_up_questions'] is List<Object?>
          ? (res['follow_up_questions']! as List<Object?>)
              .map((Object? e) => e?.toString() ?? '')
              .where((String s) => s.isNotEmpty)
              .toList()
          : const <String>[];

      if (isRedFlag) {
        await HapticService.heavy();
      }
      if (!mounted) return;
      setState(() {
        _redFlagTakeover = isRedFlag;
        _messages.add(
          _ChatEntry(
            isUser: false,
            text: replyText,
            specialty: specLabel,
            redFlag: isRedFlag,
            followUps: followUps,
          ),
        );
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _messages.add(_ChatEntry(isUser: false, text: e.toString())));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _call123() async {
    await launchUrl(Uri(scheme: 'tel', path: '123'));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    if (_redFlagTakeover) {
      return Container(
        color: Colors.black,
        padding: const EdgeInsetsDirectional.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const AiOrb(state: AiOrbState.emergency, size: 96),
            const SizedBox(height: 20),
            Text(
              l10n.emergencyTakeoverTitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFFFF3B30),
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 16),
            if (_messages.isNotEmpty)
              Text(
                _messages.last.text,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16),
              ),
            const SizedBox(height: 24),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFFF3B30),
                foregroundColor: Colors.white,
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: 28,
                  vertical: 16,
                ),
              ),
              onPressed: _call123,
              icon: const Icon(Icons.call),
              label: Text(l10n.emergencyCall123),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => setState(() => _redFlagTakeover = false),
              child: Text(
                l10n.navCommonBack,
                style: const TextStyle(color: Colors.white70),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 8),
          child: Row(
            children: <Widget>[
              AiOrb(
                state: _sending ? AiOrbState.thinking : AiOrbState.idle,
                size: 56,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.assistantDisclaimer,
                  style: TextStyle(fontSize: 12, color: colors.mutedForeground),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsetsDirectional.all(16),
            itemCount: _messages.length,
            itemBuilder: (BuildContext ctx, int idx) {
              final _ChatEntry m = _messages[idx];
              return Align(
                alignment: m.isUser
                    ? AlignmentDirectional.centerEnd
                    : AlignmentDirectional.centerStart,
                child: Container(
                  margin: const EdgeInsetsDirectional.only(bottom: 10),
                  padding: const EdgeInsetsDirectional.all(14),
                  decoration: BoxDecoration(
                    color: m.isUser ? colors.primary : colors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: m.isUser ? null : Border.all(color: colors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        m.text,
                        style: TextStyle(
                          color: m.isUser
                              ? colors.primaryForeground
                              : colors.foreground,
                        ),
                      ),
                      if (m.specialty != null) ...<Widget>[
                        const SizedBox(height: 6),
                        Text(
                          '${l10n.assistantRecommendedSpecialty}: ${m.specialty}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: colors.ai,
                          ),
                        ),
                      ],
                      if (m.followUps.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: m.followUps
                              .map(
                                (String q) => ActionChip(
                                  label: Text(q, style: const TextStyle(fontSize: 12)),
                                  onPressed: _sending
                                      ? null
                                      : () {
                                          _inputCtrl.text = q;
                                          _send();
                                        },
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 16, 16),
          child: Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: _inputCtrl,
                  decoration: InputDecoration(
                    hintText: l10n.assistantPlaceholder,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _sending ? null : _send,
                child: Text(l10n.assistantSend),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
