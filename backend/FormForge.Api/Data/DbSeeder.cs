using System.IO.Compression;
using System.Text.Json;
using FormForge.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FormForge.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(FormForgeDbContext db, CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);

        if (await db.Forms.AnyAsync(ct))
            return;

        var now = DateTimeOffset.UtcNow;
        var sampleSignature = CreateDemoSignatureDataUri();

        // 1. Canonical demo form demonstrating immutable v1 -> v2 versioning
        var intakeId = Guid.NewGuid();
        var intakeV1Id = Guid.NewGuid();
        var intakeV2Id = Guid.NewGuid();

        var v1Schema = new FormSchema
        {
            Fields =
            [
                new FieldDefinition { Id = "f1", Key = "full_name", Type = "text", Label = "Full name", Required = true },
                new FieldDefinition { Id = "f2", Key = "date_of_birth", Type = "date", Label = "Date of birth", Required = true },
                new FieldDefinition
                {
                    Id = "f3", Key = "care_level", Type = "dropdown", Label = "Care level", Required = true,
                    Options = ["Low", "Medium", "High"]
                }
            ]
        };

        var v2Schema = new FormSchema
        {
            Fields =
            [
                new FieldDefinition { Id = "f1", Key = "full_name", Type = "text", Label = "Full name", Placeholder = "e.g. Margaret Holloway", Required = true },
                new FieldDefinition { Id = "f2", Key = "date_of_birth", Type = "date", Label = "Date of birth", Required = true },
                new FieldDefinition
                {
                    Id = "f3", Key = "care_level", Type = "dropdown", Label = "Care level", Required = true,
                    Options = ["Low", "Medium", "High"]
                },
                new FieldDefinition
                {
                    Id = "f4", Key = "guardian_signature", Type = "signature", Label = "Guardian signature",
                    HelpText = "Added in v2 for legal consent verification.", Required = true
                }
            ]
        };

        var v2Json = JsonSerializer.Serialize(v2Schema, FormJson.Options);

        db.Forms.Add(new FormEntity
        {
            Id = intakeId,
            CatalogCode = "FF-001",
            Slug = "new-resident-intake",
            Title = "New Resident Intake",
            Description = "Care home resident onboarding form demonstrating immutable v1 -> v2 versioning.",
            CurrentDraftJson = v2Json,
            ActiveVersionId = intakeV2Id,
            CreatedAt = now.AddDays(-5),
            UpdatedAt = now.AddDays(-1)
        });

        db.FormVersions.AddRange(
            new FormVersionEntity
            {
                Id = intakeV1Id,
                FormId = intakeId,
                VersionNumber = 1,
                SchemaJson = JsonSerializer.Serialize(v1Schema, FormJson.Options),
                IsPublished = true,
                PublishedAt = now.AddDays(-5)
            },
            new FormVersionEntity
            {
                Id = intakeV2Id,
                FormId = intakeId,
                VersionNumber = 2,
                SchemaJson = v2Json,
                IsPublished = true,
                PublishedAt = now.AddDays(-1)
            }
        );

        db.FormResponses.AddRange(
            new FormResponseEntity
            {
                Id = Guid.NewGuid(),
                FormId = intakeId,
                FormVersionId = intakeV1Id,
                AnswersJson = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["full_name"] = "Arthur Pendelton",
                    ["date_of_birth"] = "1943-08-19",
                    ["care_level"] = "Medium"
                }, FormJson.Options),
                SubmittedAt = now.AddDays(-4)
            },
            new FormResponseEntity
            {
                Id = Guid.NewGuid(),
                FormId = intakeId,
                FormVersionId = intakeV1Id,
                AnswersJson = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["full_name"] = "Clara Whitaker",
                    ["date_of_birth"] = "1939-02-11",
                    ["care_level"] = "High"
                }, FormJson.Options),
                SubmittedAt = now.AddDays(-3)
            },
            new FormResponseEntity
            {
                Id = Guid.NewGuid(),
                FormId = intakeId,
                FormVersionId = intakeV2Id,
                AnswersJson = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["full_name"] = "Margaret Holloway",
                    ["date_of_birth"] = "1946-11-04",
                    ["care_level"] = "Low",
                    ["guardian_signature"] = sampleSignature
                }, FormJson.Options),
                SubmittedAt = now.AddHours(-6)
            }
        );

        // 2. Second realistic demo form (HR Leave Request)
        var leaveTpl = Services.StarterTemplates.FindByKey("leave-request")!;
        var leaveId = Guid.NewGuid();
        var leaveV1Id = Guid.NewGuid();
        var leaveJson = JsonSerializer.Serialize(leaveTpl.Schema, FormJson.Options);

        db.Forms.Add(new FormEntity
        {
            Id = leaveId,
            CatalogCode = "FF-002",
            Slug = "employee-leave-request",
            Title = leaveTpl.Title,
            Description = leaveTpl.Description,
            CurrentDraftJson = leaveJson,
            ActiveVersionId = leaveV1Id,
            CreatedAt = now.AddDays(-2),
            UpdatedAt = now.AddDays(-2)
        });

        db.FormVersions.Add(new FormVersionEntity
        {
            Id = leaveV1Id,
            FormId = leaveId,
            VersionNumber = 1,
            SchemaJson = leaveJson,
            IsPublished = true,
            PublishedAt = now.AddDays(-2)
        });

        db.FormResponses.Add(new FormResponseEntity
        {
            Id = Guid.NewGuid(),
            FormId = leaveId,
            FormVersionId = leaveV1Id,
            AnswersJson = JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["employee_name"] = "Priya Nair",
                ["leave_type"] = "Annual Leave",
                ["start_date"] = "2026-12-01",
                ["end_date"] = "2026-12-05",
                ["manager_signature"] = sampleSignature
            }, FormJson.Options),
            SubmittedAt = now.AddHours(-12)
        });

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Synthesizes a valid minimal grayscale PNG with a handwritten ink stroke curve
    /// so seeded demo records render real signatures in both the UI and ClosedXML exports.
    /// </summary>
    public static string CreateDemoSignatureDataUri()
    {
        const int width = 180;
        const int height = 48;
        var pixels = new byte[height * (1 + width * 4)]; // RGBA scanlines with filter byte 0

        for (int y = 0; y < height; y++)
        {
            int rowStart = y * (1 + width * 4);
            pixels[rowStart] = 0; // None filter
            for (int x = 0; x < width; x++)
            {
                int offset = rowStart + 1 + x * 4;
                pixels[offset] = 255;
                pixels[offset + 1] = 255;
                pixels[offset + 2] = 255;
                pixels[offset + 3] = 0; // transparent background
            }
        }

        // Draw a crisp dark ink signature flourish
        for (int i = 0; i < 420; i++)
        {
            double t = i / 420.0;
            int px = (int)(16 + t * 145 + Math.Sin(t * 16.0) * 6.0);
            int py = (int)(24 + Math.Sin(t * 9.5) * 11.0 - t * 3.0);
            for (int dy = -1; dy <= 1; dy++)
            {
                for (int dx = -1; dx <= 1; dx++)
                {
                    int x = Math.Clamp(px + dx, 0, width - 1);
                    int y = Math.Clamp(py + dy, 0, height - 1);
                    int idx = y * (1 + width * 4) + 1 + x * 4;
                    pixels[idx] = 15;
                    pixels[idx + 1] = 23;
                    pixels[idx + 2] = 42;
                    pixels[idx + 3] = 255;
                }
            }
        }

        var png = BuildPng(width, height, pixels);
        return $"data:image/png;base64,{Convert.ToBase64String(png)}";
    }

    private static byte[] BuildPng(int width, int height, byte[] rawScanlines)
    {
        using var ms = new MemoryStream();
        ms.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        var ihdr = new byte[13];
        WriteBigEndianInt(ihdr, 0, width);
        WriteBigEndianInt(ihdr, 4, height);
        ihdr[8] = 8; // bit depth
        ihdr[9] = 6; // RGBA
        WriteChunk(ms, "IHDR", ihdr);

        byte[] compressed;
        using (var compMs = new MemoryStream())
        {
            using (var zlib = new ZLibStream(compMs, CompressionLevel.Fastest, leaveOpen: true))
                zlib.Write(rawScanlines);
            compressed = compMs.ToArray();
        }
        WriteChunk(ms, "IDAT", compressed);
        WriteChunk(ms, "IEND", []);
        return ms.ToArray();
    }

    private static void WriteChunk(Stream stream, string type, byte[] data)
    {
        var len = new byte[4];
        WriteBigEndianInt(len, 0, data.Length);
        stream.Write(len);

        var typeBytes = System.Text.Encoding.ASCII.GetBytes(type);
        stream.Write(typeBytes);
        stream.Write(data);

        uint crc = Crc32(typeBytes, data);
        var crcBytes = new byte[4];
        WriteBigEndianInt(crcBytes, 0, unchecked((int)crc));
        stream.Write(crcBytes);
    }

    private static void WriteBigEndianInt(byte[] buf, int offset, int value)
    {
        buf[offset] = (byte)(value >> 24);
        buf[offset + 1] = (byte)(value >> 16);
        buf[offset + 2] = (byte)(value >> 8);
        buf[offset + 3] = (byte)value;
    }

    private static uint Crc32(byte[] a, byte[] b)
    {
        uint crc = 0xFFFFFFFF;
        foreach (var byt in a) crc = StepCrc(crc, byt);
        foreach (var byt in b) crc = StepCrc(crc, byt);
        return ~crc;

        static uint StepCrc(uint c, byte v)
        {
            c ^= v;
            for (int k = 0; k < 8; k++)
                c = (c & 1) != 0 ? (c >> 1) ^ 0xEDB88320u : c >> 1;
            return c;
        }
    }
}

