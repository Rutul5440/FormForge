using System.Text.RegularExpressions;
using FormForge.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FormForge.Api.Services;

public static class FormIdentityHelper
{
    public static async Task<string> GenerateUniqueSlugAsync(FormForgeDbContext db, string title, CancellationToken ct)
    {
        var baseSlug = Regex.Replace(title.ToLowerInvariant().Trim(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "form";

        var candidate = baseSlug;
        int suffix = 2;
        while (await db.Forms.AnyAsync(f => f.Slug == candidate, ct))
        {
            candidate = $"{baseSlug}-{suffix++}";
        }
        return candidate;
    }

    public static async Task<string> GenerateCatalogCodeAsync(FormForgeDbContext db, CancellationToken ct)
    {
        var count = await db.Forms.CountAsync(ct) + 1;
        string code = $"FF-{count:D3}";
        while (await db.Forms.AnyAsync(f => f.CatalogCode == code, ct))
        {
            count++;
            code = $"FF-{count:D3}";
        }
        return code;
    }
}

