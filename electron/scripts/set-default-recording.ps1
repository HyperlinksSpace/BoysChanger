# Sets Windows default *recording* device by name hint (e.g. "CABLE Output").
# Tries AudioDeviceCmdlets, then registry + IPolicyConfig (no extra modules).
# stdout: OK:<name> | ERR:<message>
$ErrorActionPreference = 'Stop'
$hint = if ($args.Count -ge 1) { [string]$args[0] } else { 'CABLE Output' }

function Set-WithAudioDeviceCmdlets([string]$nameHint) {
  Import-Module AudioDeviceCmdlets -ErrorAction Stop
  $dev = Get-AudioDevice -List |
    Where-Object {
      $_.Type -eq 'Recording' -and (
        $_.Name -like "*$nameHint*" -or
        $_.Name -match 'CABLE|VoiceMeeter|VB-Audio'
      )
    } |
    Select-Object -First 1
  if (-not $dev) { throw 'Virtual cable recording device not found. Install VB-Cable (CABLE Output).' }
  Set-AudioDevice -ID $dev.ID | Out-Null
  return $dev.Name
}

function Set-WithPolicyConfig([string]$nameHint) {
  $cSharp = @'
using System;
using System.Runtime.InteropServices;

public enum ERole : uint { eConsole = 0, eMultimedia = 1, eCommunications = 2 }

[Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
  [PreserveSig] int GetMixFormat();
  [PreserveSig] int GetDeviceFormat();
  [PreserveSig] int ResetDeviceFormat();
  [PreserveSig] int SetDeviceFormat();
  [PreserveSig] int GetProcessingPeriod();
  [PreserveSig] int SetProcessingPeriod();
  [PreserveSig] int GetShareMode();
  [PreserveSig] int SetShareMode();
  [PreserveSig] int GetPropertyValue();
  [PreserveSig] int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([In, MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId, [In, MarshalAs(UnmanagedType.U4)] ERole role);
  [PreserveSig] int SetEndpointVisibility();
}

[ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
class PolicyConfigClientCom { }

public static class WinAudioDefault {
  public static int SetDefaultDevice(string deviceId) {
    var cfg = (new PolicyConfigClientCom()) as IPolicyConfig;
    if (cfg == null) return 1;
    try {
      Marshal.ThrowExceptionForHR(cfg.SetDefaultEndpoint(deviceId, ERole.eConsole));
      Marshal.ThrowExceptionForHR(cfg.SetDefaultEndpoint(deviceId, ERole.eMultimedia));
      Marshal.ThrowExceptionForHR(cfg.SetDefaultEndpoint(deviceId, ERole.eCommunications));
      return 0;
    } catch { return 1; }
  }
}
'@
  if (-not ('WinAudioDefault' -as [type])) {
    Add-Type -TypeDefinition $cSharp -Language CSharp
  }

  $nameKey = '{a45c254e-df1c-4efd-8020-67d146a850e0},2'
  $hintLower = $nameHint.ToLowerInvariant()
  $chosen = $null
  $fallback = $null

  Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture' -ErrorAction Stop | ForEach-Object {
    $id = $_.PSChildName
    $propsPath = Join-Path $_.PSPath 'Properties'
    if (-not (Test-Path $propsPath)) { return }
    $props = Get-ItemProperty $propsPath -ErrorAction SilentlyContinue
    if (-not $props) { return }
    $name = [string]$props.$nameKey
    if (-not $name) { return }
    $lower = $name.ToLowerInvariant()
    $fullId = "{0.0.1.00000000}.$id"
    if ($lower.Contains($hintLower)) {
      $chosen = @{ Name = $name; Id = $fullId }
    } elseif (-not $fallback -and ($lower -match 'cable|voicemeeter|vb-audio|blackhole')) {
      $fallback = @{ Name = $name; Id = $fullId }
    }
  }

  if (-not $chosen) { $chosen = $fallback }
  if (-not $chosen) { throw 'Virtual cable recording device not found. Install VB-Cable (CABLE Output).' }

  $rc = [WinAudioDefault]::SetDefaultDevice($chosen.Id)
  if ($rc -ne 0) { throw 'Failed to set default recording device via PolicyConfig.' }
  return $chosen.Name
}

try {
  $name = $null
  try { $name = Set-WithAudioDeviceCmdlets $hint }
  catch { $name = Set-WithPolicyConfig $hint }
  Write-Output ("OK:" + $name)
} catch {
  Write-Output ("ERR:" + $_.Exception.Message)
}
