import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../orders/order_draft_list.dart';
import '../orders/order_draft_provider.dart';
import '../shell/agent_app_bar.dart';

/// Saqlangan buyurtma chernoviklari — alohida to‘liq sahifa (menyu «Черновик»).
class AgentDraftPage extends ConsumerStatefulWidget {
  const AgentDraftPage({super.key});

  @override
  ConsumerState<AgentDraftPage> createState() => _AgentDraftPageState();
}

class _AgentDraftPageState extends ConsumerState<AgentDraftPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh() async {
    ref.invalidate(orderDraftsProvider);
    ref.invalidate(orderDraftListProvider);
    try {
      await ref.read(orderDraftListProvider.future);
    } catch (_) {}
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final draftsAsync = ref.watch(orderDraftListProvider);
    final count = draftsAsync.valueOrNull?.length ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: count > 0 ? '${S.draft} ($count)' : S.draft,
        showBack: true,
        showSyncCountdown: false,
        onBack: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/home');
          }
        },
      ),
      body: OrderDraftPageBody(onRefresh: _refresh),
    );
  }
}
