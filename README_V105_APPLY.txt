このZIPを既存の world-trigger-arena フォルダへ上書きし、
PowerShellで次を実行してください。

powershell -ExecutionPolicy Bypass -File ".\Apply-V105-Regression-Fix.ps1"

処理完了後、git status --short で差分を確認できます。
