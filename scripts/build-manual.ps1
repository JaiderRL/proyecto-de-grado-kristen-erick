$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $root 'docs\Manual-ByteGuard.md'
$destination = Join-Path $root 'docs\Manual-ByteGuard.docx'
$body = New-Object System.Text.StringBuilder
$relationships = New-Object System.Text.StringBuilder
$pictures = @()
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Escape-Xml([string]$value) { [System.Security.SecurityElement]::Escape($value) }
function Paragraph([string]$value, [string]$style = 'Normal') {
    $safe = Escape-Xml $value
    [void]$body.Append("<w:p><w:pPr><w:pStyle w:val=`"$style`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p>")
}
$inCode = $false
$cover = $true
foreach ($line in [System.IO.File]::ReadAllLines($source, $utf8)) {
    if ($line.StartsWith('```')) { $inCode = -not $inCode; continue }
    if ($inCode) { Paragraph $line 'Code'; continue }
    if ($line -eq '<!-- page -->') {
        [void]$body.Append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
        $cover = $false
        continue
    }
    if ($line -match '^!\[(.*?)\]\((.*?)\)$') {
        $description = Escape-Xml $Matches[1]
        $file = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $source -Parent) $Matches[2]))
        $id = $pictures.Count + 1
        $bitmap = [System.Drawing.Image]::FromFile($file)
        try {
            $scale = [Math]::Min(5.9 / $bitmap.Width, 6.5 / $bitmap.Height)
            $cx = [long]($bitmap.Width * $scale * 914400)
            $cy = [long]($bitmap.Height * $scale * 914400)
        } finally { $bitmap.Dispose() }
        $pictures += @{ File = $file; Name = "image$id.png" }
        [void]$relationships.Append("<Relationship Id=`"image$id`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image`" Target=`"media/image$id.png`"/>")
        [void]$body.Append(@"
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="$cx" cy="$cy"/><wp:docPr id="$id" name="Evidence $id" descr="$description"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="$id" name="image$id.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image$id"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$cx" cy="$cy"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
"@)
        continue
    }
    if ($line.StartsWith('# ')) {
        if ($cover) { Paragraph $line.Substring(2) 'Title' } else { Paragraph $line.Substring(2) 'Heading1' }
    } elseif ($line.StartsWith('## ')) {
        if ($cover) { Paragraph $line.Substring(3) 'Subtitle' } else { Paragraph $line.Substring(3) 'Heading2' }
    } elseif ($line.StartsWith('- ')) { Paragraph ('• ' + $line.Substring(2)) }
    elseif ($line.Trim()) {
        if ($cover) { Paragraph $line 'CoverText' }
        elseif ($line.StartsWith('Figura ')) { Paragraph $line 'Caption' }
        else { Paragraph $line }
    }
}
$styles = @'
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="23332E"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="270" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="1500" w:after="400"/></w:pPr><w:rPr><w:b/><w:sz w:val="76"/><w:color w:val="193D30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="700"/></w:pPr><w:rPr><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CoverText"><w:name w:val="Cover text"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="200" w:after="240"/></w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="100" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="193D30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="160" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="355E49"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="225" w:lineRule="auto"/><w:shd w:fill="F0F3EB"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="19"/></w:rPr></w:style>
</w:styles>
'@
$document = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>$body<w:sectPr><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1100" w:bottom="1000" w:left="1100" w:header="400" w:footer="450"/><w:titlePg/></w:sectPr></w:body></w:document>
"@
$types = @'
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>
'@
$rootRels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
$docRels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="footer" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + $relationships + '</Relationships>'
$footer = '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="627367"/></w:rPr><w:t xml:space="preserve">ByteGuard · Manual de uso | </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>'
$stream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
function Add-Part([string]$name, [string]$content) {
    $entry = $zip.CreateEntry($name)
    $writer = New-Object System.IO.StreamWriter($entry.Open(), $utf8)
    try { $writer.Write($content) } finally { $writer.Dispose() }
}
try {
    Add-Part '[Content_Types].xml' $types
    Add-Part '_rels/.rels' $rootRels
    Add-Part 'word/document.xml' $document
    Add-Part 'word/styles.xml' $styles
    Add-Part 'word/_rels/document.xml.rels' $docRels
    Add-Part 'word/footer1.xml' $footer
    foreach ($picture in $pictures) {
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $picture.File, ('word/media/' + $picture.Name))
    }
} finally { $zip.Dispose(); $stream.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($destination)
try {
    foreach ($entry in $check.Entries) {
        if ($entry.FullName.EndsWith('.xml') -or $entry.FullName.EndsWith('.rels')) {
            $reader = New-Object System.IO.StreamReader($entry.Open())
            try { [xml]$part = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
    }
    Write-Output "DOCX creado y XML validado: $destination"
    Write-Output "Imagenes incrustadas: $($pictures.Count)"
} finally { $check.Dispose() }
