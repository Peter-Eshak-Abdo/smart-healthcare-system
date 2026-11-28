import 'package:flutter/material.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _pageController = PageController();
  final _step1FormKey = GlobalKey<FormState>();
  final _step2FormKey = GlobalKey<FormState>();

  int _currentStep = 0;
  String _selectedRole = 'patient';
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isSubmitting = false;

  // Step 1 controllers
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // Step 2 controllers
  final _fullNameController = TextEditingController();
  final _nationalIdController = TextEditingController();
  final _dobController = TextEditingController();
  final _licenseController = TextEditingController();
  final _specialtyController = TextEditingController();
  String _sex = 'male';
  String _bloodType = 'O+';

  @override
  void dispose() {
    _pageController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _fullNameController.dispose();
    _nationalIdController.dispose();
    _dobController.dispose();
    _licenseController.dispose();
    _specialtyController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_step1FormKey.currentState?.validate() ?? false) {
      setState(() => _currentStep = 1);
      _pageController.animateToPage(
        1,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _previousStep() {
    setState(() => _currentStep = 0);
    _pageController.animateToPage(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _submit() async {
    if (!(_step2FormKey.currentState?.validate() ?? false)) return;
    setState(() => _isSubmitting = true);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('تم إنشاء الحساب بنجاح / Account created')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMedicalStaff =
        _selectedRole == 'doctor' ||
        _selectedRole == 'pharmacist' ||
        _selectedRole == 'paramedic';

    return Scaffold(
      appBar: AppBar(
        title: const Text('إنشاء حساب جديد'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Animated Stepper Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                children: [
                  _StepBadge(
                    stepNumber: 1,
                    label: 'بيانات الدخول',
                    isActive: _currentStep == 0,
                    isCompleted: _currentStep > 0,
                  ),
                  Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 350),
                      height: 3,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: _currentStep > 0
                            ? theme.colorScheme.primary
                            : theme.colorScheme.outlineVariant,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  _StepBadge(
                    stepNumber: 2,
                    label: 'البيانات الشخصية',
                    isActive: _currentStep == 1,
                    isCompleted: false,
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  // Step 1: Credentials & Role
                  SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Form(
                      key: _step1FormKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          DropdownButtonFormField<String>(
                            initialValue: _selectedRole,
                            decoration: const InputDecoration(
                              labelText: 'نوع الحساب / Account Role',
                              prefixIcon: Icon(Icons.badge_outlined),
                              border: OutlineInputBorder(),
                            ),
                            items: const [
                              DropdownMenuItem(value: 'patient', child: Text('مريض (Patient)')),
                              DropdownMenuItem(value: 'doctor', child: Text('طبيب (Doctor)')),
                              DropdownMenuItem(value: 'pharmacist', child: Text('صيدلي (Pharmacist)')),
                              DropdownMenuItem(value: 'paramedic', child: Text('مسعف (Paramedic)')),
                              DropdownMenuItem(value: 'admin', child: Text('إدارة (Admin)')),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedRole = val);
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'رقم الهاتف / Phone Number',
                              prefixIcon: Icon(Icons.phone_outlined),
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().length < 8) ? 'أدخل رقم هاتف صحيح' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'البريد الإلكتروني / Email',
                              prefixIcon: Icon(Icons.email_outlined),
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) =>
                                (v == null || !v.contains('@')) ? 'أدخل بريد إلكتروني صحيح' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'كلمة المرور / Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              border: const OutlineInputBorder(),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                ),
                                onPressed: () =>
                                    setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (v) =>
                                (v == null || v.length < 8) ? 'كلمة المرور 8 أحرف على الأقل' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _confirmPasswordController,
                            obscureText: _obscureConfirm,
                            decoration: InputDecoration(
                              labelText: 'تأكيد كلمة المرور / Confirm Password',
                              prefixIcon: const Icon(Icons.lock_reset_outlined),
                              border: const OutlineInputBorder(),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscureConfirm ? Icons.visibility_off : Icons.visibility,
                                ),
                                onPressed: () =>
                                    setState(() => _obscureConfirm = !_obscureConfirm),
                              ),
                            ),
                            validator: (v) => v != _passwordController.text
                                ? 'كلمة المرور غير متطابقة'
                                : null,
                          ),
                          const SizedBox(height: 28),
                          FilledButton.icon(
                            onPressed: _nextStep,
                            icon: const Icon(Icons.arrow_forward),
                            label: const Text('التالي: البيانات الشخصية'),
                            style: FilledButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Step 2: Personal Information
                  SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Form(
                      key: _step2FormKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextFormField(
                            controller: _fullNameController,
                            decoration: const InputDecoration(
                              labelText: 'الاسم الكامل / Full Name',
                              prefixIcon: Icon(Icons.person_outline),
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().length < 2) ? 'أدخل الاسم الكامل' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _nationalIdController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'الرقم القومي / National ID',
                              prefixIcon: Icon(Icons.credit_card_outlined),
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().length < 6) ? 'أدخل الرقم القومي' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _dobController,
                            decoration: const InputDecoration(
                              labelText: 'تاريخ الميلاد (YYYY-MM-DD)',
                              prefixIcon: Icon(Icons.calendar_today_outlined),
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().isEmpty) ? 'أدخل تاريخ الميلاد' : null,
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            initialValue: _sex,
                            decoration: const InputDecoration(
                              labelText: 'النوع / Sex',
                              prefixIcon: Icon(Icons.wc_outlined),
                              border: OutlineInputBorder(),
                            ),
                            items: const [
                              DropdownMenuItem(value: 'male', child: Text('ذكر (Male)')),
                              DropdownMenuItem(value: 'female', child: Text('أنثى (Female)')),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _sex = val);
                            },
                          ),
                          const SizedBox(height: 16),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 300),
                            child: _selectedRole == 'patient'
                                ? DropdownButtonFormField<String>(
                                    key: const ValueKey('patient_fields'),
                                    initialValue: _bloodType,
                                    decoration: const InputDecoration(
                                      labelText: 'فصيلة الدم / Blood Type',
                                      prefixIcon: Icon(Icons.bloodtype_outlined),
                                      border: OutlineInputBorder(),
                                    ),
                                    items: const [
                                      'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
                                    ]
                                        .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                                        .toList(),
                                    onChanged: (val) {
                                      if (val != null) setState(() => _bloodType = val);
                                    },
                                  )
                                : isMedicalStaff
                                    ? Column(
                                        key: const ValueKey('staff_fields'),
                                        children: [
                                          TextFormField(
                                            controller: _licenseController,
                                            decoration: const InputDecoration(
                                              labelText: 'رقم الترخيص الطبي / License Number',
                                              prefixIcon: Icon(Icons.verified_user_outlined),
                                              border: OutlineInputBorder(),
                                            ),
                                            validator: (v) => (v == null || v.trim().length < 3)
                                                ? 'رقم الترخيص مطلوب للطاقم الطبي'
                                                : null,
                                          ),
                                          const SizedBox(height: 16),
                                          TextFormField(
                                            controller: _specialtyController,
                                            decoration: const InputDecoration(
                                              labelText: 'التخصص / Specialty',
                                              prefixIcon: Icon(Icons.medical_services_outlined),
                                              border: OutlineInputBorder(),
                                            ),
                                          ),
                                        ],
                                      )
                                    : const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 28),
                          Row(
                            children: [
                              OutlinedButton.icon(
                                onPressed: _previousStep,
                                icon: const Icon(Icons.arrow_back),
                                label: const Text('السابق'),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 16,
                                    horizontal: 20,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: _isSubmitting ? null : _submit,
                                  icon: _isSubmitting
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Icon(Icons.check_circle_outline),
                                  label: const Text('إنشاء الحساب'),
                                  style: FilledButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepBadge extends StatelessWidget {
  const _StepBadge({
    required this.stepNumber,
    required this.label,
    required this.isActive,
    required this.isCompleted,
  });

  final int stepNumber;
  final String label;
  final bool isActive;
  final bool isCompleted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bgColor = isActive || isCompleted
        ? theme.colorScheme.primary
        : theme.colorScheme.surfaceContainerHighest;
    final fgColor = isActive || isCompleted
        ? theme.colorScheme.onPrimary
        : theme.colorScheme.onSurfaceVariant;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 34,
          height: 34,
          decoration: BoxDecoration(color: bgColor, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: isCompleted
              ? Icon(Icons.check, size: 18, color: fgColor)
              : Text(
                  '$stepNumber',
                  style: TextStyle(color: fgColor, fontWeight: FontWeight.bold),
                ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}
