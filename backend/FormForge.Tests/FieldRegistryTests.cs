using System.Text.Json;
using FormForge.Api.Data;
using FormForge.Api.FieldRegistry;
using FormForge.Api.Models;

namespace FormForge.Tests;

public sealed class FieldRegistryTests
{
    private static FieldRegistryService CreateRegistry() => new(
    [
        new TextFieldHandler(),
        new DateFieldHandler(),
        new DropdownFieldHandler(),
        new SignatureFieldHandler()
    ]);

    [Fact]
    public void Dropdown_RejectsValueNotInSchemaOptions()
    {
        var registry = CreateRegistry();
        var schema = new FormSchema
        {
            Fields =
            [
                new FieldDefinition
                {
                    Id = "f1",
                    Key = "care_level",
                    Type = "dropdown",
                    Label = "Care level",
                    Required = true,
                    Options = ["Low", "Medium", "High"]
                }
            ]
        };

        var answers = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            """{"care_level": "AdminOverride"}""")!;

        var (isValid, _, errors) = registry.ValidateSubmission(schema, answers);

        Assert.False(isValid);
        Assert.True(errors.ContainsKey("care_level"));
    }

    [Fact]
    public void Date_EnforcesIsoFormatAndBounds()
    {
        var registry = CreateRegistry();
        var schema = new FormSchema
        {
            Fields =
            [
                new FieldDefinition
                {
                    Id = "f1",
                    Key = "dob",
                    Type = "date",
                    Label = "Date of birth",
                    Required = true,
                    Validation = new FieldValidation { MinDate = "1920-01-01", MaxDate = "2020-12-31" }
                }
            ]
        };

        var invalidDate = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            """{"dob": "2025-05-01"}""")!;
        var (isValid, _, errors) = registry.ValidateSubmission(schema, invalidDate);
        Assert.False(isValid);
        Assert.True(errors.ContainsKey("dob"));

        var validDate = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            """{"dob": "1952-07-14"}""")!;
        var (ok, normalized, okErrors) = registry.ValidateSubmission(schema, validDate);
        Assert.True(ok);
        Assert.Empty(okErrors);
        Assert.Equal("1952-07-14", normalized["dob"]);
    }

    [Fact]
    public void Signature_RejectsForgedNonPngPayload_AndAcceptsValidPng()
    {
        var registry = CreateRegistry();
        var schema = new FormSchema
        {
            Fields =
            [
                new FieldDefinition
                {
                    Id = "f1",
                    Key = "sig",
                    Type = "signature",
                    Label = "Guardian signature",
                    Required = true
                }
            ]
        };

        var forged = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            """{"sig": "data:image/png;base64,bm90LWEtcG5nLWZpbGU="}""")!;
        var (forgedValid, _, forgedErrors) = registry.ValidateSubmission(schema, forged);
        Assert.False(forgedValid);
        Assert.True(forgedErrors.ContainsKey("sig"));

        var validPngUri = DbSeeder.CreateDemoSignatureDataUri();
        var validPayload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            JsonSerializer.Serialize(new Dictionary<string, string> { ["sig"] = validPngUri }))!;
        var (ok, _, okErrors) = registry.ValidateSubmission(schema, validPayload);
        Assert.True(ok);
        Assert.Empty(okErrors);
    }
}
