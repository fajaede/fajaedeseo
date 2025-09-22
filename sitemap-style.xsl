<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    >

    <xsl:output method="html" indent="yes"/>

    <xsl:template match="/">
        <html>
        <head>
            <title>XML Sitemap</title>
            <style>
                h1 { color: #3150a1; font-family: Arial, sans-serif; }
                .xmlraw { font-family: monospace; background: #fafafa; padding: 1em; border-radius: 6px; border: 1px solid #ddd; white-space: pre; overflow-x: auto;}
            </style>
        </head>
        <body>
            <h1>XML fajaede_Sitemap</h1>
            <div class="xmlraw">
                <xsl:copy-of select="."/>
            </div>
        </body>
        </html>
    </xsl:template>

</xsl:stylesheet>
