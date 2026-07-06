import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Sinxronizatsiya jarayonida fon ustida markaziy loader (shablon).
class AgentSyncLoadingOverlay extends StatelessWidget {
  const AgentSyncLoadingOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return AbsorbPointer(
      child: Stack(
        children: [
          ModalBarrier(
            color: Colors.black.withValues(alpha: 0.35),
            dismissible: false,
          ),
          Center(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const SizedBox(
                width: 72,
                height: 72,
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
