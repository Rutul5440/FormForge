using FormForge.Api.Data;
using FormForge.Api.FieldRegistry;
using FormForge.Api.Models;
using FormForge.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(opts =>
{
    opts.JsonSerializerOptions.PropertyNamingPolicy = FormJson.Options.PropertyNamingPolicy;
    opts.JsonSerializerOptions.DefaultIgnoreCondition = FormJson.Options.DefaultIgnoreCondition;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=FormForgeDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

builder.Services.AddDbContext<FormForgeDbContext>(options => options.UseSqlServer(connectionString));

// Register reusable field-type handlers via DI so new field types extend without modifying existing forms.
builder.Services.AddSingleton<IFieldTypeHandler, TextFieldHandler>();
builder.Services.AddSingleton<IFieldTypeHandler, DateFieldHandler>();
builder.Services.AddSingleton<IFieldTypeHandler, DropdownFieldHandler>();
builder.Services.AddSingleton<IFieldTypeHandler, SignatureFieldHandler>();
builder.Services.AddSingleton<FieldRegistryService>();
builder.Services.AddScoped<ExcelExportService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:4200", "http://127.0.0.1:4200")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FormForgeDbContext>();
    await DbSeeder.SeedAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.MapControllers();

app.Run();

public partial class Program;
