using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using FormForge.Api.Data;
using FormForge.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FormForge.Tests;

public sealed class FormForgeWebAppFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = $"FormForgeTest_{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var toRemove = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<FormForgeDbContext>)
                    || (d.ServiceType.FullName?.Contains("DbContextOptionsConfiguration") ?? false))
                .ToList();
            foreach (var d in toRemove) services.Remove(d);

            services.AddDbContext<FormForgeDbContext>(options =>
                options.UseInMemoryDatabase(_dbName));
        });
    }
}

public sealed class VersioningAndExportTests : IClassFixture<FormForgeWebAppFactory>
{
    private readonly HttpClient _client;

    public VersioningAndExportTests(FormForgeWebAppFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PublishingV2_PreservesV1ResponsesAndVersionSpecificExcelColumns()
    {
        // 1. Create a brand new form with 2 fields
        var createRes = await _client.PostAsJsonAsync("/api/forms", new
        {
            title = "Clinic Consent Check",
            description = "Version isolation integration test",
            schema = new FormSchema
            {
                Fields =
                [
                    new FieldDefinition { Id = "f1", Key = "patient_name", Type = "text", Label = "Patient name", Required = true },
                    new FieldDefinition { Id = "f2", Key = "triage_tier", Type = "dropdown", Label = "Triage tier", Required = true, Options = ["Standard", "Priority"] }
                ]
            }
        });
        createRes.EnsureSuccessStatusCode();
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var formId = created.GetProperty("id").GetGuid();
        var slug = created.GetProperty("slug").GetString()!;

        // 2. Publish v1
        var pub1Res = await _client.PostAsync($"/api/forms/{formId}/publish", null);
        pub1Res.EnsureSuccessStatusCode();
        var v1 = await pub1Res.Content.ReadFromJsonAsync<JsonElement>();
        var v1Id = v1.GetProperty("id").GetGuid();
        Assert.Equal(1, v1.GetProperty("versionNumber").GetInt32());

        // 3. Submit response to v1 (plus verify invalid answer gets 400)
        var badSubmit = await _client.PostAsJsonAsync($"/api/public/forms/{slug}/responses", new
        {
            answers = new Dictionary<string, string>
            {
                ["patient_name"] = "Dana Scully",
                ["triage_tier"] = "BogusOption"
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, badSubmit.StatusCode);

        var okV1Submit = await _client.PostAsJsonAsync($"/api/public/forms/{slug}/responses", new
        {
            answers = new Dictionary<string, string>
            {
                ["patient_name"] = "Dana Scully",
                ["triage_tier"] = "Priority"
            }
        });
        Assert.Equal(HttpStatusCode.Created, okV1Submit.StatusCode);

        // 4. Update draft to add a 3rd field (signature) & publish v2
        var updateRes = await _client.PutAsJsonAsync($"/api/forms/{formId}/draft", new
        {
            title = "Clinic Consent Check",
            description = "Updated with signature",
            schema = new FormSchema
            {
                Fields =
                [
                    new FieldDefinition { Id = "f1", Key = "patient_name", Type = "text", Label = "Patient name", Required = true },
                    new FieldDefinition { Id = "f2", Key = "triage_tier", Type = "dropdown", Label = "Triage tier", Required = true, Options = ["Standard", "Priority"] },
                    new FieldDefinition { Id = "f3", Key = "patient_sig", Type = "signature", Label = "Patient signature", Required = true }
                ]
            }
        });
        updateRes.EnsureSuccessStatusCode();

        var pub2Res = await _client.PostAsync($"/api/forms/{formId}/publish", null);
        pub2Res.EnsureSuccessStatusCode();
        var v2 = await pub2Res.Content.ReadFromJsonAsync<JsonElement>();
        var v2Id = v2.GetProperty("id").GetGuid();
        Assert.Equal(2, v2.GetProperty("versionNumber").GetInt32());

        // 5. Submit response to v2 with formula-like text to test injection neutralization in Excel
        var okV2Submit = await _client.PostAsJsonAsync($"/api/public/forms/{slug}/responses", new
        {
            answers = new Dictionary<string, string>
            {
                ["patient_name"] = "=HYPERLINK(\"http://evil\",\"Fox Mulder\")",
                ["triage_tier"] = "Standard",
                ["patient_sig"] = DbSeeder.CreateDemoSignatureDataUri()
            }
        });
        Assert.Equal(HttpStatusCode.Created, okV2Submit.StatusCode);

        // 6. Export v1 Excel: must have exactly 2 dynamic columns (Patient name, Triage tier) + 3 metadata columns
        var v1Xlsx = await _client.GetByteArrayAsync($"/api/forms/{formId}/export?versionId={v1Id}");
        using (var wb1 = new XLWorkbook(new MemoryStream(v1Xlsx)))
        {
            var ws1 = wb1.Worksheets.First();
            Assert.Equal("Patient name", ws1.Cell(1, 4).GetString());
            Assert.Equal("Triage tier", ws1.Cell(1, 5).GetString());
            Assert.True(string.IsNullOrEmpty(ws1.Cell(1, 6).GetString()));
            Assert.Equal("Dana Scully", ws1.Cell(2, 4).GetString());
            Assert.Equal("Priority", ws1.Cell(2, 5).GetString());
        }

        // 7. Export v2 Excel: must have 3 dynamic columns + embedded signature picture + neutralized formula
        var v2Xlsx = await _client.GetByteArrayAsync($"/api/forms/{formId}/export?versionId={v2Id}");
        using (var wb2 = new XLWorkbook(new MemoryStream(v2Xlsx)))
        {
            var ws2 = wb2.Worksheets.First();
            Assert.Equal("Patient name", ws2.Cell(1, 4).GetString());
            Assert.Equal("Triage tier", ws2.Cell(1, 5).GetString());
            Assert.Equal("Patient signature", ws2.Cell(1, 6).GetString());
            Assert.False(ws2.Cell(2, 4).HasFormula);
            Assert.True(ws2.Cell(2, 4).Style.IncludeQuotePrefix);
            Assert.Equal("=HYPERLINK(\"http://evil\",\"Fox Mulder\")", ws2.Cell(2, 4).GetString());
            Assert.Single(ws2.Pictures);
        }
    }

    [Fact]
    public async Task StarterTemplates_ReturnsFiveTemplates_AndClonesIntoEditableDraft()
    {
        var templates = await _client.GetFromJsonAsync<JsonElement[]>("/api/templates");
        Assert.NotNull(templates);
        Assert.Equal(5, templates.Length);

        var cloneRes = await _client.PostAsync("/api/templates/feedback-survey/clone", null);
        Assert.Equal(HttpStatusCode.Created, cloneRes.StatusCode);
        var cloned = await cloneRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrWhiteSpace(cloned.GetProperty("slug").GetString()));
    }
}
