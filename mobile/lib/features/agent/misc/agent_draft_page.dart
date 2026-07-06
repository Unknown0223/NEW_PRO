import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';

/// Qoralama (shablon DraftScreen).
class AgentDraftPage extends StatelessWidget {
  const AgentDraftPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: 'Черновик', showBack: true),
      body: AgentEmptyState.fill(message: S.emptyDraft),
    );
  }
}
