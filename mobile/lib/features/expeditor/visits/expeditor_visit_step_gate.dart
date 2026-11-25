enum VisitUiStep { visit, photo, statusPayment }

VisitUiStep nextVisitUiStep({
  required bool visitStarted,
  required bool photoOk,
}) {
  if (!visitStarted) return VisitUiStep.visit;
  if (!photoOk) return VisitUiStep.photo;
  return VisitUiStep.statusPayment;
}
