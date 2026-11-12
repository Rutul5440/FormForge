using System.Text.Json;
using System.Text.Json.Serialization;

namespace FormForge.Api.Models;

public static class FormJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

public sealed class FormSchema
{
    public List<FieldDefinition> Fields { get; set; } = [];
}

public sealed class FieldDefinition
{
    public string Id { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string Type { get; set; } = "text";
    public string Label { get; set; } = string.Empty;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }
    public bool Required { get; set; }
    public List<string>? Options { get; set; }
    public FieldValidation? Validation { get; set; }
}

public sealed class FieldValidation
{
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public string? Pattern { get; set; }
    public bool? Multiline { get; set; }
    public string? MinDate { get; set; }
    public string? MaxDate { get; set; }
}

public sealed record FieldTypeDescriptor(
    string Type,
    string DisplayName,
    string Description,
    string AccentColor,
    string DefaultLabel,
    bool SupportsOptions,
    List<string>? DefaultOptions = null
);

public sealed record StarterTemplateDefinition(
    string Key,
    string Title,
    string Category,
    string Description,
    FormSchema Schema
);
