; Extra installer rules for StashWiki.

!ifndef BUILD_UNINSTALLER
  ; A silent install counts as an update, as if --updated had been passed. The in-app update button of
  ; StashWiki 0.12.0 and older runs the installer silently without --updated, and because the install folder
  ; can be changed, the installer then removes the old shortcuts and makes new ones, which unpins
  ; StashWiki from the taskbar. As an update it keeps them (only when reinstalling into the same folder).
  !macroundef _isUpdated
  !macro _isUpdated _a _b _t _f
    ${StdUtils.TestParameter} $R9 "updated"
    IfSilent 0 +2
      StrCpy $R9 "true"
    StrCmp "$R9" "true" `${_t}` `${_f}`
  !macroend
!endif
