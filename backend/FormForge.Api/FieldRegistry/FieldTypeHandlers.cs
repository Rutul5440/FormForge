using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using FormForge.Api.Models;

namespace FormForge.Api.FieldRegistry;

public sealed class TextFieldHandler : IFieldTypeHandler
{
    private const int HardMaxLength = 4000;
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    public FieldTypeDescriptor Descriptor { get; } = new(
        Type: "text",
        DisplayName: "Text Input",
        Description: "Single or multi-line text with length and pattern rules",
        AccentColor: "#0d6e6e",
        DefaultLabel: "Text field",
        SupportsOptions: false
    );

    public string? ValidateFieldDefinition(FieldDefinition field)
    {
        var v = field.Validation;
        if (v is null) return null;

        if (v.MinLength is < 0 || v.MaxLength is < 1 || v.MaxLength > HardMaxLength)
            return $"Field '{field.Label}': text length bounds must sit between 0 and {HardMaxLength}.";

        if (v.MinLength.HasValue && v.MaxLength.HasValue && v.MinLength > v.MaxLength)
            return $"Field '{field.Label}': minLength cannot exceed maxLength.";

        if (!string.IsNullOrWhiteSpace(v.Pattern))
        {
            try
            {
                _ = new Regex(v.Pattern, RegexOptions.None, RegexTimeout);
            }
            catch (ArgumentException ex)
            {
                return $"Field '{field.Label}': invalid regex pattern ({ex.Message}).";
            }
        }

        return null;
    }

    public bool TryValidateAnswer(
        FieldDefinition field,
        JsonElement? rawValue,
        out object? normalizedValue,
        out string? error)
    {
        normalizedValue = null;
        error = null;

        string text;
        if (rawValue is null || rawValue.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            text = string.Empty;
        }
        else if (rawValue.Value.ValueKind == JsonValueKind.String)
        {
            text = (rawValue.Value.GetString() ?? string.Empty).Trim();
        }
        else
        {
            error = $"{field.Label} must be a text value.";
            return false;
        }

        if (string.IsNullOrEmpty(text))
        {
            if (field.Required)
            {
                error = $"{field.Label} is required.";
                return false;
            }

            return true;
        }

        var v = field.Validation;
        int maxLen = Math.Min(v?.MaxLength ?? HardMaxLength, HardMaxLength);

        if (v?.MinLength is int minLen && text.Length < minLen)
        {
            error = $"{field.Label} must be at least {minLen} characters.";
            return false;
        }

        if (text.Length > maxLen)
        {
            error = $"{field.Label} cannot exceed {maxLen} characters.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(v?.Pattern))
        {
            try
            {
                if (!Regex.IsMatch(text, v.Pattern, RegexOptions.None, RegexTimeout))
                {
                    error = $"{field.Label} does not match the required format.";
                    return false;
                }
            }
            catch (RegexMatchTimeoutException)
            {
                error = $"{field.Label} validation timed out.";
                return false;
            }
        }

        normalizedValue = text;
        return true;
    }

    public string FormatCellText(FieldDefinition field, JsonElement? rawValue) =>
        rawValue is { ValueKind: JsonValueKind.String } el ? el.GetString() ?? string.Empty : string.Empty;
}

public sealed class DateFieldHandler : IFieldTypeHandler
{
    public FieldTypeDescriptor Descriptor { get; } = new(
        Type: "date",
        DisplayName: "Date Picker",
        Description: "ISO calendar date with optional min/max bounds",
        AccentColor: "#b45309",
        DefaultLabel: "Date field",
        SupportsOptions: false
    );

    public string? ValidateFieldDefinition(FieldDefinition field)
    {
        var v = field.Validation;
        if (v is null) return null;

        DateOnly? min = null;
        DateOnly? max = null;

        if (!string.IsNullOrWhiteSpace(v.MinDate))
        {
            if (!TryParseIsoDate(v.MinDate, out var parsedMin))
                return $"Field '{field.Label}': minDate must be YYYY-MM-DD.";
            min = parsedMin;
        }

        if (!string.IsNullOrWhiteSpace(v.MaxDate))
        {
            if (!TryParseIsoDate(v.MaxDate, out var parsedMax))
                return $"Field '{field.Label}': maxDate must be YYYY-MM-DD.";
            max = parsedMax;
        }

        if (min.HasValue && max.HasValue && min > max)
            return $"Field '{field.Label}': minDate cannot be later than maxDate.";

        return null;
    }

    public bool TryValidateAnswer(
        FieldDefinition field,
        JsonElement? rawValue,
        out object? normalizedValue,
        out string? error)
    {
        normalizedValue = null;
        error = null;

        if (rawValue is null || rawValue.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            if (field.Required)
            {
                error = $"{field.Label} is required.";
                return false;
            }
            return true;
        }

        if (rawValue.Value.ValueKind != JsonValueKind.String)
        {
            error = $"{field.Label} must be an ISO date string (YYYY-MM-DD).";
            return false;
        }

        var str = (rawValue.Value.GetString() ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(str))
        {
            if (field.Required)
            {
                error = $"{field.Label} is required.";
                return false;
            }
            return true;
        }

        if (!TryParseIsoDate(str, out var date))
        {
            error = $"{field.Label} must be a valid date (YYYY-MM-DD).";
            return false;
        }

        var v = field.Validation;
        if (!string.IsNullOrWhiteSpace(v?.MinDate) && TryParseIsoDate(v.MinDate, out var min) && date < min)
        {
            error = $"{field.Label} must be on or after {min:yyyy-MM-dd}.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(v?.MaxDate) && TryParseIsoDate(v.MaxDate, out var max) && date > max)
        {
            error = $"{field.Label} must be on or before {max:yyyy-MM-dd}.";
            return false;
        }

        normalizedValue = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return true;
    }

    public string FormatCellText(FieldDefinition field, JsonElement? rawValue) =>
        rawValue is { ValueKind: JsonValueKind.String } el ? el.GetString() ?? string.Empty : string.Empty;

    private static bool TryParseIsoDate(string value, out DateOnly date) =>
        DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
}

public sealed class DropdownFieldHandler : IFieldTypeHandler
{
    public FieldTypeDescriptor Descriptor { get; } = new(
        Type: "dropdown",
        DisplayName: "Dropdown Select",
        Description: "Controlled choice list validated against schema options",
        AccentColor: "#2563eb",
        DefaultLabel: "Dropdown field",
        SupportsOptions: true,
        DefaultOptions: ["Option 1", "Option 2", "Option 3"]
    );

    public string? ValidateFieldDefinition(FieldDefinition field)
    {
        var opts = field.Options?.Where(o => !string.IsNullOrWhiteSpace(o)).ToList() ?? [];
        if (opts.Count == 0)
            return $"Field '{field.Label}': dropdown must include at least one non-empty option.";
        return null;
    }

    public bool TryValidateAnswer(
        FieldDefinition field,
        JsonElement? rawValue,
        out object? normalizedValue,
        out string? error)
    {
        normalizedValue = null;
        error = null;

        if (rawValue is null || rawValue.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            if (field.Required)
            {
                error = $"{field.Label} is required.";
                return false;
            }
            return true;
        }

        if (rawValue.Value.ValueKind != JsonValueKind.String)
        {
            error = $"{field.Label} selection must be text.";
            return false;
        }

        var selected = (rawValue.Value.GetString() ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(selected))
        {
            if (field.Required)
            {
                error = $"{field.Label} is required.";
                return false;
            }
            return true;
        }

        var allowed = field.Options ?? [];
        if (!allowed.Contains(selected, StringComparer.Ordinal))
        {
            error = $"{field.Label} selection '{selected}' is not a valid schema option.";
            return false;
        }

        normalizedValue = selected;
        return true;
    }

    public string FormatCellText(FieldDefinition field, JsonElement? rawValue) =>
        rawValue is { ValueKind: JsonValueKind.String } el ? el.GetString() ?? string.Empty : string.Empty;
}

public sealed class SignatureFieldHandler : IFieldTypeHandler
{
    private const string PngDataUriPrefix = "data:image/png;base64,";
    private const int MaxDecodedBytes = 512 * 1024;
    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public FieldTypeDescriptor Descriptor { get; } = new(
        Type: "signature",
        DisplayName: "Signature Pad",
        Description: "Pointer & touch PNG ink attestation",
        AccentColor: "#7c3aed",
        DefaultLabel: "Signature",
        SupportsOptions: false
    );

    public string? ValidateFieldDefinition(FieldDefinition field) => null;

    public bool TryValidateAnswer(
        FieldDefinition field,
        JsonElement? rawValue,
        out object? normalizedValue,
        out string? error)
    {
        normalizedValue = null;
        error = null;

        if (rawValue is null || rawValue.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            if (field.Required)
            {
                error = $"{field.Label} signature is required.";
                return false;
            }
            return true;
        }

        if (rawValue.Value.ValueKind != JsonValueKind.String)
        {
            error = $"{field.Label} must be a PNG signature data URI.";
            return false;
        }

        var uri = (rawValue.Value.GetString() ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(uri))
        {
            if (field.Required)
            {
                error = $"{field.Label} signature is required.";
                return false;
            }
            return true;
        }

        if (!TryExtractPngBytes(uri, out var bytes, out var parseError))
        {
            error = $"{field.Label}: {parseError}";
            return false;
        }

        // Reject trivial/empty tiny buffers (< 64 bytes cannot hold a valid signature PNG).
        if (bytes.Length < 64)
        {
            error = $"{field.Label} signature image is empty or corrupted.";
            return false;
        }

        normalizedValue = uri;
        return true;
    }

    public string FormatCellText(FieldDefinition field, JsonElement? rawValue) =>
        TryExtractPngBytes(rawValue is { ValueKind: JsonValueKind.String } el ? el.GetString() : null, out _, out _)
            ? "Signed (PNG)"
            : string.Empty;

    public static bool TryExtractPngBytes(string? dataUri, out byte[] pngBytes, out string? error)
    {
        pngBytes = [];
        error = null;

        if (string.IsNullOrWhiteSpace(dataUri) || !dataUri.StartsWith(PngDataUriPrefix, StringComparison.Ordinal))
        {
            error = "invalid signature format (expected PNG data URI).";
            return false;
        }

        var base64 = dataUri[PngDataUriPrefix.Length..];
        if (base64.Length > (MaxDecodedBytes * 4 / 3) + 16)
        {
            error = "signature image exceeds 512 KB limit.";
            return false;
        }

        try
        {
            pngBytes = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            error = "signature payload is not valid base64.";
            return false;
        }

        if (pngBytes.Length > MaxDecodedBytes)
        {
            error = "signature image exceeds 512 KB limit.";
            return false;
        }

        if (pngBytes.Length < PngMagic.Length || !pngBytes.AsSpan(0, PngMagic.Length).SequenceEqual(PngMagic))
        {
            error = "signature payload is not a valid PNG binary.";
            return false;
        }

        return true;
    }
}

public sealed class FieldRegistryService(IEnumerable<IFieldTypeHandler> handlers)
{
    private readonly Dictionary<string, IFieldTypeHandler> _handlers =
        handlers.ToDictionary(h => h.Descriptor.Type, StringComparer.OrdinalIgnoreCase);

    public IReadOnlyList<FieldTypeDescriptor> GetDescriptors() =>
        _handlers.Values.Select(h => h.Descriptor).ToList();

    public IFieldTypeHandler? Resolve(string type) =>
        _handlers.TryGetValue(type, out var handler) ? handler : null;

    public List<string> ValidateSchema(FormSchema schema)
    {
        var errors = new List<string>();
        if (schema.Fields.Count == 0)
        {
            errors.Add("Form must contain at least one field.");
            return errors;
        }

        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var field in schema.Fields)
        {
            if (string.IsNullOrWhiteSpace(field.Id))
                errors.Add("Every field must have a non-empty id.");
            else if (!seenIds.Add(field.Id))
                errors.Add($"Duplicate field id '{field.Id}'.");

            var effectiveKey = string.IsNullOrWhiteSpace(field.Key) ? field.Id : field.Key;
            if (string.IsNullOrWhiteSpace(effectiveKey))
                errors.Add("Every field must have a non-empty schema key.");
            else if (!seenKeys.Add(effectiveKey))
                errors.Add($"Duplicate field key '{effectiveKey}'.");

            if (string.IsNullOrWhiteSpace(field.Label))
                errors.Add($"Field '{field.Id}' must have a label.");

            var handler = Resolve(field.Type);
            if (handler is null)
            {
                errors.Add($"Unsupported field type '{field.Type}'.");
                continue;
            }

            var handlerError = handler.ValidateFieldDefinition(field);
            if (handlerError is not null)
                errors.Add(handlerError);
        }

        return errors;
    }

    public (bool IsValid, Dictionary<string, object?> NormalizedAnswers, Dictionary<string, string> Errors)
        ValidateSubmission(FormSchema schema, Dictionary<string, JsonElement> submittedAnswers)
    {
        var normalized = new Dictionary<string, object?>(StringComparer.Ordinal);
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var field in schema.Fields)
        {
            var answerKey = string.IsNullOrWhiteSpace(field.Key) ? field.Id : field.Key;
            JsonElement? rawValue = null;
            if (submittedAnswers.TryGetValue(answerKey, out var byKey))
                rawValue = byKey;
            else if (submittedAnswers.TryGetValue(field.Id, out var byId))
                rawValue = byId;

            var handler = Resolve(field.Type);
            if (handler is null)
            {
                errors[answerKey] = $"Unsupported field type '{field.Type}'.";
                continue;
            }

            if (handler.TryValidateAnswer(field, rawValue, out var value, out var err))
            {
                normalized[answerKey] = value;
            }
            else if (err is not null)
            {
                errors[answerKey] = err;
            }
        }

        return (errors.Count == 0, normalized, errors);
    }
}

