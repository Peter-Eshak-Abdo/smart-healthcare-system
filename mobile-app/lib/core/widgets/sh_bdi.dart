import 'package:flutter/widgets.dart';

/// BiDi isolate wrapper so MRNs, drug doses, Rx numbers, and dates always keep
/// clean LTR ordering inside Egyptian Arabic RTL layouts.
class ShBdi extends StatelessWidget {
  const ShBdi(
    this.text, {
    super.key,
    this.style,
    this.textAlign,
  });

  final String text;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text(
        text,
        style: style,
        textAlign: textAlign,
      ),
    );
  }
}
