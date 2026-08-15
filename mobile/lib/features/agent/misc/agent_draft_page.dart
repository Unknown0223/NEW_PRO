import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../orders/order_draft_list.dart';
import '../shell/agent_app_bar.dart';

/// Saqlangan buyurtma chernoviklari.
class AgentDraftPage extends ConsumerWidget {
  const AgentDraftPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(title: 'Черновик', showBack: true),
      body: OrderDraftPageBody(),
    );
  }
}
