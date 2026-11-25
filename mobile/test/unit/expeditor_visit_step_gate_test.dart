import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/visits/expeditor_visit_step_gate.dart';

void main() {
  test('nextStep before visit → visit', () {
    expect(
      nextVisitUiStep(visitStarted: false, photoOk: false),
      VisitUiStep.visit,
    );
  });

  test('nextStep after visit without photo → photo', () {
    expect(
      nextVisitUiStep(visitStarted: true, photoOk: false),
      VisitUiStep.photo,
    );
  });

  test('nextStep after photo → statusPayment', () {
    expect(
      nextVisitUiStep(visitStarted: true, photoOk: true),
      VisitUiStep.statusPayment,
    );
  });
}
