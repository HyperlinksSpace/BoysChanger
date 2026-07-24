; Bundled VB-CABLE (donationware from https://www.vb-cable.com)
; Installed during BoysChanger setup when the driver pack is present.
!macro customInstall
  IfFileExists "$INSTDIR\resources\vbcable\VBCABLE_Setup_x64.exe" 0 vbcable_skip
    DetailPrint "Installing VB-CABLE virtual audio driver (vb-cable.com)…"
    ; -i install, -h hide UI; Windows may still show a driver trust prompt
    ExecWait '"$INSTDIR\resources\vbcable\VBCABLE_Setup_x64.exe" -i -h' $0
    DetailPrint "VB-CABLE installer exit code: $0"
    MessageBox MB_ICONINFORMATION|MB_OK "VB-CABLE was installed.$\r$\n$\r$\nPlease reboot Windows so Telegram and other apps can see CABLE Output.$\r$\n$\r$\nVB-CABLE is donationware by VB-Audio — https://www.vb-cable.com"
  vbcable_skip:
!macroend
