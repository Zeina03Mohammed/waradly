import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:waradly_app/main.dart';

void main() {
  testWidgets('shows the login screen when logged out', (tester) async {
    // No stored tokens -> _RootRouter should resolve straight to LoginScreen.
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const WaradlyApp());
    await tester.pumpAndSettle();

    expect(find.text('Waradly'), findsOneWidget);
    expect(find.text('Log in'), findsOneWidget);
    expect(find.text('No account yet? Register'), findsOneWidget);
  });
}
