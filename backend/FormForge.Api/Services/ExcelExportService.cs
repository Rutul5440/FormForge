using System.Text.Json;
using ClosedXML.Excel;
using FormForge.Api.Data;
using FormForge.Api.FieldRegistry;
using FormForge.Api.Models;

namespace FormForge.Api.Services;

public sealed class ExcelExportService(FieldRegistryService registry)
{
    public byte[] BuildWorkbook(
        FormEntity form,
        FormVersionEntity version,
        IReadOnlyList<FormResponseEntity> responses)
    {
        var schema = JsonSerializer.Deserialize<FormSchema>(version.SchemaJson, FormJson.Options) ?? new FormSchema();

        using var workbook = new XLWorkbook();
        var sheetName = SanitizeWorksheetName($"{form.CatalogCode}-v{version.VersionNumber}");
        var ws = workbook.Worksheets.Add(sheetName);

        // Header columns derived dynamically from this immutable FormVersion schema
        var headers = new List<string> { "Response ID", "Submitted At (UTC)", "Version" };
        headers.AddRange(schema.Fields.Select(f => f.Label));

        for (int col = 0; col < headers.Count; col++)
        {
            var cell = ws.Cell(1, col + 1);
            cell.Value = headers[col];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0d6e6e");
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }
        ws.Row(1).Height = 26;

        for (int rowIdx = 0; rowIdx < responses.Count; rowIdx++)
        {
            int excelRow = rowIdx + 2;
            var resp = responses[rowIdx];
            var answers = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(resp.AnswersJson, FormJson.Options)
                ?? new Dictionary<string, JsonElement>();

            ws.Cell(excelRow, 1).Value = resp.Id.ToString("N")[..8].ToUpperInvariant();
            ws.Cell(excelRow, 2).Value = resp.SubmittedAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss");
            ws.Cell(excelRow, 3).Value = $"v{version.VersionNumber}";

            bool rowHasSignatureImage = false;

            for (int fIdx = 0; fIdx < schema.Fields.Count; fIdx++)
            {
                var field = schema.Fields[fIdx];
                int excelCol = fIdx + 4;
                var key = string.IsNullOrWhiteSpace(field.Key) ? field.Id : field.Key;
                JsonElement? rawValue = answers.TryGetValue(key, out var val) ? val : null;

                var cell = ws.Cell(excelRow, excelCol);

                if (string.Equals(field.Type, "signature", StringComparison.OrdinalIgnoreCase)
                    && rawValue is { ValueKind: JsonValueKind.String } sigEl
                    && SignatureFieldHandler.TryExtractPngBytes(sigEl.GetString(), out var pngBytes, out _))
                {
                    try
                    {
                        using var imgStream = new MemoryStream(pngBytes);
                        var picture = ws.AddPicture(imgStream)
                            .MoveTo(cell, 4, 4)
                            .WithSize(136, 36);
                        rowHasSignatureImage = true;
                        cell.Value = string.Empty;
                        ws.Column(excelCol).Width = Math.Max(ws.Column(excelCol).Width, 22);
                    }
                    catch
                    {
                        cell.Value = "Signed (PNG)";
                    }
                }
                else
                {
                    var handler = registry.Resolve(field.Type);
                    var text = handler is not null
                        ? handler.FormatCellText(field, rawValue)
                        : rawValue?.ToString() ?? string.Empty;
                    cell.Value = text;
                    if (IsFormulaTrigger(text))
                    {
                        cell.Style.IncludeQuotePrefix = true;
                    }
                }

                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Alignment.WrapText = true;
            }

            ws.Row(excelRow).Height = rowHasSignatureImage ? 44 : 22;
        }

        ws.Columns(1, Math.Max(1, headers.Count)).AdjustToContents(minWidth: 14, maxWidth: 48);
        ws.SheetView.FreezeRows(1);

        using var outStream = new MemoryStream();
        workbook.SaveAs(outStream);
        return outStream.ToArray();
    }

    /// <summary>
    /// Marks spreadsheet values beginning with formula trigger characters so Excel renders them as literal text.
    /// </summary>
    public static bool IsFormulaTrigger(string? value) =>
        !string.IsNullOrEmpty(value) && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r';

    private static string SanitizeWorksheetName(string raw)
    {
        var invalid = new[] { ':', '\\', '/', '?', '*', '[', ']' };
        var cleaned = new string(raw.Where(c => !invalid.Contains(c)).ToArray()).Trim();
        if (string.IsNullOrEmpty(cleaned)) cleaned = "Responses";
        return cleaned.Length <= 31 ? cleaned : cleaned[..31];
    }
}
