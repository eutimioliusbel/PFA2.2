using System.Net.Http.Headers;

namespace PEMS_API_TESTING
{
    internal class BasicAuthenticationHeaderValue : AuthenticationHeaderValue
    {
        public BasicAuthenticationHeaderValue(string scheme, string parameter) : base(scheme, parameter)
        {
        }
    }
}