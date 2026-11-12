using System.Text.Json;
using FormForge.Api.Data;
using FormForge.Api.FieldRegistry;
using FormForge.Api.Models;
using FormForge.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FormForge.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class MetadataController(FieldRegistryService registry, FormForgeDbContext db) : ControllerBase
{
    [HttpGet("field-types")]
    public ActionResult<IReadOnlyList<FieldTypeDescriptor>> GetFieldTypes() =>
        Ok(registry.GetDescriptors());

    [HttpGet("templates")]
    public ActionResult<IReadOnlyList<StarterTemplateDefinition>> GetTemplates() =>
        Ok(StarterTemplates.All);

    [HttpPost("templates/{key}/clone")]
    public async Task<ActionResult<object>> CloneTemplate(string key, CancellationToken ct)
    {
        var template = StarterTemplates.FindByKey(key);
        if (template is null)
            return NotFound(new { message = $"Starter template '{key}' not found." });

        var slug = await FormIdentityHelper.GenerateUniqueSlugAsync(db, template.Title, ct);
        var catalogCode = await FormIdentityHelper.GenerateCatalogCodeAsync(db, ct);
        var now = DateTimeOffset.UtcNow;

        var form = new FormEntity
        {
            Id = Guid.NewGuid(),
            CatalogCode = catalogCode,
            Slug = slug,
            Title = template.Title,
            Description = template.Description,
            CurrentDraftJson = JsonSerializer.Serialize(template.Schema, FormJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Forms.Add(form);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(FormsController.GetForm),
            "Forms",
            new { id = form.Id },
            new { id = form.Id, form.Slug, form.CatalogCode, form.Title });
    }
}
