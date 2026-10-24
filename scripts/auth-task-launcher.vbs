Option Explicit
Dim fso, shell, root, executable, scriptName, command, index, result
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
If WScript.Arguments.Count < 2 Then WScript.Quit 64
executable = WScript.Arguments(0)
scriptName = WScript.Arguments(1)
If LCase(fso.GetFileName(executable)) <> "node.exe" Then WScript.Quit 64
If Not fso.FileExists(executable) Then WScript.Quit 64
If scriptName <> "auth-keepalive-once.cjs" And scriptName <> "auth-operations-dashboard.cjs" Then WScript.Quit 64
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = root
command = Quoted(executable) & " " & Quoted(fso.BuildPath(fso.BuildPath(root, "scripts"), scriptName))
For index = 2 To WScript.Arguments.Count - 1
  command = command & " " & Quoted(WScript.Arguments(index))
Next
On Error Resume Next
result = shell.Run(command, 0, True)
If Err.Number <> 0 Then WScript.Quit 1
On Error GoTo 0
WScript.Quit result
Function Quoted(value)
  If InStr(value, Chr(34)) > 0 Or InStr(value, vbCr) > 0 Or InStr(value, vbLf) > 0 Then WScript.Quit 64
  Quoted = Chr(34) & value & Chr(34)
End Function
