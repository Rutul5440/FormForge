using System.Text.Json;
using FormForge.Api.Models;

namespace FormForge.Api.FieldRegistry;

/// <summary>
/// Pluggable contract for reusable metadata field types. Adding a new field type
/// requires implementing this interface and registering it in DI without editing existing forms.
/// </summary>
public interface IFieldTypeHandler
{
    FieldTypeDescriptor Descriptor { get; }

    string? ValidateFieldDefinition(FieldDefinition field);

    bool TryValidateAnswer(
        FieldDefinition field,
        JsonElement? rawValue,
        out object? normalizedValue,
        out string? error);

    string FormatCellText(FieldDefinition field, JsonElement? rawValue);
}
