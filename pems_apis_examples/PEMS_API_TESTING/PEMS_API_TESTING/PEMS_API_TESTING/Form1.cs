using System;
using System.Windows.Forms;
using System.Net.Http;
using System.Net;
using System.IO;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using System.Data;
using System.Text;
using System.Xml.Linq;
using Newtonsoft.Json;
using System.Linq;

namespace PEMS_API_TESTING
{
    public partial class Form1 : Form
    {
        public int vTotal = 0;
        public String filterStatus = String.Empty;
        public Form1()
        {
            InitializeComponent();
        }

        static DataTable ConvertListToDataTable(List<List<string>> list)
        {

            DataTable table = new DataTable();

            int columns = 0;
            foreach (var item in list)
            {
                if (item.Count > columns)
                {
                    columns = item.Count;
                }
            }

            for (int i = 0; i < columns; i++)
            {
                table.Columns.Add();
            }

            foreach (var item in list)
            {
                DataRow new_row = table.NewRow();
                foreach (var col in item)
                {
                    new_row[item.IndexOf(col)] = col;
                }
                table.Rows.Add(new_row);
            }

            return table;
        }
        private void button1_Click(object sender, EventArgs e)
        {
            //dataGridView1.Visible = false;
            advancedDataGridView1.Visible = false;
            string endPoint = "https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata";
     
            //ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls;
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;

            //MessageBox.Show(comboBox1.Text);

            //HttpMethod httpMethod = HttpMethod.Get;
            HttpMethod httpMethod = HttpMethod.Post;
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(endPoint);
           
            //request.MaximumResponseHeadersLength = 4;

            HttpClient httpClient = HttpClientFactory.Create();
            
            string vuser = "APIUSER";
            string vpass = "BEOSugarland2025!";
            
            string vcreds = Convert.ToBase64String(ASCIIEncoding.ASCII.GetBytes(vuser + ":" + vpass));
            request.Method = httpMethod.ToString();
            request.Accept = "application/json";
            request.Headers.Add("tenant: BECHTEL_DEV");
            request.Headers.Add("organization: BECH");
            request.ContentType = "application/json";
            request.Headers.Add("Authorization", "Basic " + vcreds);           
           
            //request.Timeout = 500000;
            string requestBody = @"{""GRID"": {""GRID_NAME"": ""CUPFAG"", ""GRID_ID"": ""100541"",""NUMBER_OF_ROWS_FIRST_RETURNED"": 10000,""RESULT_IN_SAXORDER"": ""TRUE""}, 
            ""ADDON_SORT"": {""ALIAS_NAME"": ""pfs_id"",""TYPE"": ""ASC""},
            ""ADDON_FILTER"": {""ALIAS_NAME"": ""pfs_a_org"",""OPERATOR"": ""BEGINS"",""VALUE"": ""SELECTORG"" },
            ""GRID_TYPE"": { ""TYPE"": ""LIST""  },""LOV_PARAMETER"":{ ""ALIAS_NAME"":""pfs_id""},  ""REQUEST_TYPE"": ""LIST.DATA_ONLY.STORED""}";

            requestBody = requestBody.Replace("SELECTORG", comboBox1.Text);

            byte[] byteArray = Encoding.UTF8.GetBytes(requestBody);
            request.ContentLength = byteArray.Length;

            using (Stream dataStream = request.GetRequestStream())
            {
                dataStream.Write(byteArray, 0, byteArray.Length);
            }
            HttpWebResponse response = null;

            try
            {
                response = (HttpWebResponse)request.GetResponse();
                
                using (Stream responsestream = response.GetResponseStream())
                {
                    if (responsestream != null)
                    {
                        using (StreamReader reader = new StreamReader(responsestream))
                        {
                            var doc = reader.ReadToEnd();

                            JObject rss = JObject.Parse(doc);

                            DataTable table = new DataTable();
                            table.Columns.Add("Description", typeof(string));
                            table.Columns.Add("PFA ID", typeof(string));
                            table.Columns.Add("Original Row ID", typeof(string));
                            table.Columns.Add("Project Revision Number", typeof(string));
                            table.Columns.Add("Project Number", typeof(string));
                            table.Columns.Add("PEMS Organization", typeof(string));
                            table.Columns.Add("ESS Project Desc ", typeof(string));
                            table.Columns.Add("Category Group", typeof(string));
                            table.Columns.Add("Class (Plan)", typeof(string));
                            table.Columns.Add("Category (Plan)", typeof(string));
                            table.Columns.Add("Category Description (Plan)", typeof(string));
                            table.Columns.Add("Manufacturer (Make) (Plan)", typeof(string));
                            table.Columns.Add("Model (Plan)", typeof(string));
                            table.Columns.Add("Source (Plan)", typeof(string));
                            table.Columns.Add("DOR (Plan)", typeof(string));
                            table.Columns.Add("Project Budget Code (Plan)", typeof(string));
                            table.Columns.Add("Duration (in Months) (Plan)", typeof(string));
                            table.Columns.Add("Estimated Start Date (Plan)", typeof(string));
                            table.Columns.Add("Estimated End Date (Plan)", typeof(string));
                            table.Columns.Add("Escalated Rental Rate (Plan)", typeof(string));
                            table.Columns.Add("Rental Rate UOM (Plan)", typeof(string));
                            table.Columns.Add("OCR Rate (Plan)", typeof(string));
                            table.Columns.Add("OCR Rate UOM (Plan)", typeof(string));
                            table.Columns.Add("Rate Used (Plan)", typeof(string));
                            table.Columns.Add("Escalated Purchase Price (Plan)", typeof(string));
                            table.Columns.Add("Estimated Rental Amount (Plan)", typeof(string));
                            table.Columns.Add("Created Date (Plan)", typeof(string));
                            table.Columns.Add("Modified Date (Plan)", typeof(string));
                            table.Columns.Add("Lead Times Rental (Plan)", typeof(string));
                            table.Columns.Add("Lead Times Purchase (Plan)", typeof(string));
                            table.Columns.Add("QSR (Plan)", typeof(string));
                            table.Columns.Add("Total OCRR (Plan)", typeof(string));
                            table.Columns.Add("Variance (Plan)", typeof(string));
                            table.Columns.Add("Modify depreciation to straight line formula (Plan)", typeof(string));
                            table.Columns.Add("Mitigation (Plan)", typeof(string));
                            table.Columns.Add("Freight (Plan)", typeof(string));
                            table.Columns.Add("Consumables (Plan)", typeof(string));
                            table.Columns.Add("Class", typeof(string));
                            table.Columns.Add("Category", typeof(string));
                            table.Columns.Add("Category Description", typeof(string));
                            table.Columns.Add("Manufacturer (Make)", typeof(string));
                            table.Columns.Add("Model", typeof(string));
                            table.Columns.Add("Source", typeof(string));
                            table.Columns.Add("DOR", typeof(string));
                            table.Columns.Add("Estimated Start Date", typeof(string));
                            table.Columns.Add("Estimated End Date", typeof(string));
                            table.Columns.Add("Duration (in Months)", typeof(string));
                            table.Columns.Add("Rental Rate", typeof(string));
                            table.Columns.Add("Rental Rate UOM", typeof(string));
                            table.Columns.Add("Purchase Price", typeof(string));
                            table.Columns.Add("Estimated Rental Amount", typeof(string));
                            table.Columns.Add("Last Forecast Change Date", typeof(string));
                            table.Columns.Add("Lead Time", typeof(string));
                            table.Columns.Add("Consumables", typeof(string));
                            table.Columns.Add("Last Forecast Revision", typeof(string));
                            table.Columns.Add("Last Forecast Change By", typeof(string));
                            table.Columns.Add("Actualized", typeof(string));
                            table.Columns.Add("Discontinued", typeof(string));
                            table.Columns.Add("Area/Silo", typeof(string));
                            table.Columns.Add("Freight", typeof(string));
                            table.Columns.Add("Original PFA ID", typeof(string));
                            table.Columns.Add("Contract", typeof(string));
                            table.Columns.Add("Contract Revision", typeof(string));
                            table.Columns.Add("Equipment", typeof(string));
                            table.Columns.Add("Actualization Date", typeof(string));
                            table.Columns.Add("Actualized By", typeof(string));
                            table.Columns.Add("Funds Transferable", typeof(string));
                            table.Columns.Add("unknown", typeof(string));
                            table.Columns.Add("date1", typeof(string));
                            table.Columns.Add("date2", typeof(string));
                            table.Columns.Add("date3", typeof(string));
                            table.Columns.Add("user1", typeof(string));
                            table.Columns.Add("user2", typeof(string));


                            JArray vdat = (JArray)rss["Result"]["ResultData"]["GRID"]["DATA"]["ROW"];
                            //var vdat = rss["Result"]["ResultData"]["GRID"]["DATA"]["ROW"];                                

                            foreach (var vpfa in vdat)
                            {
                                var vcol = vpfa.ToString().Replace("},", "~");
                               

                                string[] columns = vcol.Split('~');

                               // MessageBox.Show(columns[0].Split(':')[2].Replace("\",","").Replace("\"n\"","").Remove(0, 2));
                                table.Rows.Add(columns[0].Split(':')[2].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[1].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[2].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[3].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[4].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[5].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[6].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[7].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[8].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[9].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[10].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[11].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[12].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[13].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[14].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[15].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[16].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[17].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[18].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[19].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[20].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[21].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[22].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[23].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[24].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[25].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[26].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[27].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[28].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[29].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[30].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[31].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[32].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[33].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[34].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[35].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[36].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[37].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[38].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[39].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[40].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[41].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[42].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[43].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[44].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[45].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[46].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[47].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[48].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[49].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[50].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[51].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[52].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[53].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[54].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[55].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[56].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[57].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[58].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[59].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[60].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[61].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[62].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[63].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[64].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[65].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[66].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[67].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[68].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[69].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[70].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[71].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                , columns[72].Split(':')[1].Replace("\",", "").Replace("\"n\"", "").Remove(0, 2)
                                );



                            }

                            //advancedDataGridView1.DataSource = table;
                            dataTable1BindingSource.DataSource = table;
                            vTotal = (advancedDataGridView1.RowCount - 1);
                            label1.Text = "Total: " + vTotal.ToString();
                            label1.Visible = true;

                        }
                        
                        advancedDataGridView1.Visible = true;

                    }
                }

            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.ToString());
            }
            finally
            {
                ((IDisposable)response).Dispose();
            }

        }

        public class PFAData
        {
            public string Description { get; set; }
            public decimal PFA_ID { get; set; }
  
        }

        private void advancedDataGridView1_FilterStringChanged(object sender, EventArgs e)
        {
            toolStrip1.Visible = true;
            dataTable1BindingSource.Filter = advancedDataGridView1.FilterString;
            int vfiltered = advancedDataGridView1.Rows.GetRowCount(DataGridViewElementStates.Visible) - 1;

            if (vfiltered != advancedDataGridView1.RowCount - 1)
            {
                label1.Text = "Filtered: " + vfiltered.ToString();
            }
            else
            {
                label1.Text = "Total: " + (advancedDataGridView1.RowCount - 1).ToString() + " of " + vTotal.ToString();
            }
        }

        private void label1_Click(object sender, EventArgs e)
        {
            
        }

        private void ShowAllLabel_Click(object sender, EventArgs e)
        {
            DataGridViewAutoFilterColumnHeaderCell.RemoveFilter(advancedDataGridView1);

            advancedDataGridView1.ClearFilter();

            filterStatus = String.Empty;

            vTotal = (advancedDataGridView1.RowCount - 1);
            label1.Text = "Total: " + vTotal.ToString();

            toolStrip1.Visible = false;

           

        }
    }
}
