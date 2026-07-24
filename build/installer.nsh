; BoysChanger NSIS — branded welcome/finish, quiet VB-CABLE, reboot now/later
; Included in the script header (before pages). Do not !include MUI2 here.

!define MUI_INSTFILESPAGE_COLORS "E8F2EC 0B1210"

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to BoysChanger"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Shape race, gender, age, timbre and effects — then use your new voice in Telegram, Discord, and games.$\r$\n$\r$\nSetup quietly installs the VB-CABLE virtual audio driver so other apps can hear your changed voice as a microphone.$\r$\n$\r$\nAt the end you can reboot now or later — a reboot activates CABLE Output for Telegram."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Replaces the default finish page (reboot copy; no “Run app” checkbox).
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "BoysChanger is installed"
  !define MUI_FINISHPAGE_TEXT "Your voice studio is on disk.$\r$\n$\r$\nWindows still needs a short reboot so the virtual cable microphone (CABLE Output) appears for Telegram and other apps."
  !define MUI_FINISHPAGE_TEXT_REBOOT "A reboot is required to finish registering VB-CABLE.$\r$\n$\r$\nWithout it, Telegram will not see CABLE Output and the voice changer cannot be used system-wide.$\r$\n$\r$\nVB-CABLE is donationware by VB-Audio — www.vb-cable.com"
  !define MUI_FINISHPAGE_TEXT_REBOOTNOW "Reboot now"
  !define MUI_FINISHPAGE_TEXT_REBOOTLATER "I will reboot later"
  !define MUI_FINISHPAGE_NOAUTOCLOSE
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customInstall
  ; Quiet VB-CABLE — no MessageBox; reboot is offered on the finish page
  IfFileExists "$INSTDIR\resources\vbcable\VBCABLE_Setup_x64.exe" 0 vbcable_skip
    DetailPrint "Installing VB-CABLE virtual audio driver…"
    ExecWait '"$INSTDIR\resources\vbcable\VBCABLE_Setup_x64.exe" -i -h' $0
    DetailPrint "VB-CABLE setup finished (code $0)"
  vbcable_skip:

  ; Always offer reboot on finish — the virtual mic only appears after Windows reloads drivers
  SetRebootFlag true
!macroend

!macro customInstallMode
  StrCpy $isForceMachineInstall "1"
!macroend
